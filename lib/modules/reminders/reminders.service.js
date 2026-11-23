// =============================================================
// التذكير بالعناصر المعلّقة
// -------------------------------------------------------------
// • المشرف (أو المدير) يذكّر منسق دورة بعناصرها المعلّقة: ما حلّ موعده
//   ولم يُقدَّم، بمواعيده وتأخره — في رسالة داخلية وإشعار وبريد.
// • ويذكّر فريقه كله بضغطة: لكل منسق رسالة واحدة تجمع دوراته.
// • والمنسق يذكّر مشرف دورته بما ينتظر اعتماده — مشرفها هو لا كل المشرفين.
// والتذكير مرة في اليوم للدورة الواحدة، فلا يصير إزعاجاً.
// =============================================================
const prisma = require('../../db/prisma');
const permissions = require('../../services/permissions');
const { computeElementDeadlines } = require('../../shared/deadlines');
const { AppError } = require('../../shared/AppError');
const audit = require('../../services/audit');
const notifications = require('../../services/notifications');

const DAY = 24 * 3600 * 1000;
const COOLDOWN_MS = 20 * 3600 * 1000; // مرة في اليوم تقريباً
const OPEN = ['NOT_STARTED', 'RETURNED', 'REJECTED'];
const fmt = (d) => new Date(d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' });
const name = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

const COURSE_SELECT = {
  id: true, name: true, status: true, startDate: true, endDate: true, operationalProjectId: true,
  primaryEmployeeId: true, entryBaselineAt: true, lateEntryStatus: true, certificateTypeChangedAt: true, certificateTypeResolvedAt: true, courseType: true,
  primaryEmployee: { select: { id: true, firstName: true, lastName: true, isCollaborator: true, followUpSupervisorId: true, operationalProjectId: true, isActive: true } },
  closureElements: {
    where: { status: { in: OPEN } },
    select: {
      id: true, status: true, executionAt: true, extensionHours: true,
      element: { select: { key: true, name: true, deadlineIdealHours: true, deadlineMaxHours: true, deadlineRefPoint: true, isDeadlineWorkingDays: true } },
      blockers: { select: { isCredited: true, raisedAt: true, resolvedAt: true, status: true } },
    },
  },
};

/** العناصر المعلّقة المستحقة: حلّ موعدها المثالي ولم تُقدَّم (والمُعاد والمرفوض دائماً) */
function pendingElements(course, now = new Date()) {
  const out = [];
  for (const t of course.closureElements || []) {
    if (!OPEN.includes(t.status)) continue;
    if (t.blockers?.some((b) => b.status === 'OPEN')) continue; // متوقّف ببلاغ قائم
    const d = computeElementDeadlines(t, course, now);
    const returned = t.status !== 'NOT_STARTED';
    if (!returned && (!d.hasDeadline || d.excludedFromTiming || now < d.idealDeadline)) continue;
    const lateDays = d.maxDeadline && now > d.maxDeadline ? Math.ceil((now - d.maxDeadline) / DAY) : 0;
    out.push({
      name: t.element?.name || 'عنصر',
      status: t.status,
      lateDays,
      maxDeadline: d.maxDeadline || null,
      line: returned
        ? `• ${t.element?.name} — ${t.status === 'RETURNED' ? 'أُعيد للتصحيح' : 'رُفض'} وينتظر إعادة تقديمه`
        : lateDays
          ? `• ${t.element?.name} — متأخر ${lateDays} يوماً عن موعده الأقصى`
          : `• ${t.element?.name} — موعده الأقصى ${fmt(d.maxDeadline)}`,
    });
  }
  return out.sort((a, b) => b.lateDays - a.lateDays);
}

async function lastReminderAt(courseId) {
  const row = await prisma.auditLog.findFirst({
    where: { courseId, action: 'COORDINATOR_REMINDED' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  }).catch(() => null);
  return row?.createdAt || null;
}

async function canRemindCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole !== 'PROJECT_SUPERVISOR') return false;
  return permissions.canDecideElement(user, activeRole, course);
}

/** رسالة داخلية + إشعار + بريد (البريد لا يعطّل التذكير) */
async function deliver({ senderId, recipientId, subject, text, courseId, notifTitle, data }) {
  const msg = await prisma.message.create({
    data: {
      senderId, subject, body: text, courseId: courseId || null,
      recipients: { create: [{ recipientId }] },
    },
    select: { id: true },
  });
  await notifications.createNotification(recipientId, 'COORDINATOR_REMINDER', notifTitle, text.slice(0, 300), { ...(data || {}), messageId: msg.id, courseId });
  try {
    const u = await prisma.user.findUnique({ where: { id: recipientId }, select: { email: true, firstName: true } });
    if (u?.email && /@/.test(u.email)) {
      const base = process.env.NEXT_PUBLIC_SITE_URL || '';
      require('../../email').sendReminderMessage({ to: u.email, firstName: u.firstName, subject, text, ctaUrl: courseId && base ? `${base}/courses/${courseId}` : undefined }).catch(() => {});
    }
  } catch { /* البريد لا يعطّل التذكير */ }
}

function messageFor(course, items, senderName, note) {
  const lines = items.map((i) => i.line).join('\n');
  return [
    `تذكير من ${senderName} بالعناصر المعلّقة في دورة «${course.name}»:`,
    '',
    lines,
    note ? `\nملاحظة: ${note}` : '',
    '\nنأمل تقديمها في أقرب وقت — وإن كان التأخير خارج يدك فارفع بلاغ عائق من صفحة الدورة.',
  ].filter((x) => x !== '').join('\n');
}

/** معاينة: ما الذي سيُذكَّر به في دورة */
async function previewCourse(courseId, user, activeRole) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
  if (!course) throw AppError.notFound('الدورة غير موجودة', 'serverErrors.course.notFound');
  const allowed = await canRemindCourse(user, activeRole, course);
  const last = await lastReminderAt(courseId);
  return {
    allowed: allowed && course.primaryEmployeeId !== user.id,
    items: pendingElements(course).map(({ name: n, status, lateDays, maxDeadline }) => ({ name: n, status, lateDays, maxDeadline })),
    lastReminderAt: last,
    cooldownUntil: last ? new Date(new Date(last).getTime() + COOLDOWN_MS) : null,
    coordinator: course.primaryEmployee ? name(course.primaryEmployee) : null,
  };
}

/** تذكير منسق دورة بعناصرها المعلّقة */
async function remindCourse(courseId, body, user, activeRole) {
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
  if (!course) throw AppError.notFound('الدورة غير موجودة', 'serverErrors.course.notFound');
  if (!(await canRemindCourse(user, activeRole, course))) {
    throw AppError.forbidden('التذكير لمشرف مشروع الدورة أو المدير', 'serverErrors.reminders.forbidden');
  }
  if (course.primaryEmployeeId === user.id) throw AppError.badRequest('هذه دورتك أنت', 'serverErrors.reminders.ownCourse');
  if (!course.primaryEmployee?.isActive) throw AppError.badRequest('منسق الدورة غير نشط', 'serverErrors.reminders.inactive');
  const items = pendingElements(course);
  if (!items.length) throw AppError.badRequest('لا عناصر معلّقة حلّ موعدها في هذه الدورة', 'serverErrors.reminders.nothingPending');
  const last = await lastReminderAt(courseId);
  if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) {
    const hours = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(last).getTime())) / 3600000);
    throw AppError.badRequest(`ذُكّر منسق هذه الدورة اليوم — يُتاح تذكير جديد بعد ${hours} ساعة`, 'serverErrors.reminders.cooldown');
  }
  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } });
  const note = String(body?.note || '').trim().slice(0, 500);
  const text = messageFor(course, items, name(sender), note);
  await deliver({
    senderId: user.id, recipientId: course.primaryEmployeeId, courseId,
    subject: `تذكير: عناصر معلّقة في «${course.name}»`,
    notifTitle: `🔔 تذكير من ${name(sender)}: ${items.length} عنصر معلّق في «${course.name}»`,
    text,
  });
  await audit.logAudit(user.id, activeRole, 'COORDINATOR_REMINDED', { courseId, elements: items.map((i) => i.name), note: note || null }, courseId);
  return { sent: 1, items: items.length, coordinator: name(course.primaryEmployee) };
}

/** دورات الفريق المفتوحة التي فيها ما يُذكَّر به */
async function teamCourses(user, activeRole) {
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole)) {
    throw AppError.forbidden('التذكير للمشرف والمدير', 'serverErrors.reminders.forbidden');
  }
  const where = await permissions.buildCoursesWhere(user, activeRole, { status: { notIn: ['CLOSED', 'ARCHIVED'] } });
  const courses = await prisma.course.findMany({ where, select: COURSE_SELECT });
  return courses.filter((c) => c.primaryEmployeeId !== user.id && c.primaryEmployee?.isActive);
}

/** معاينة الفريق: لكل منسق دوراته المعلّقة */
async function previewTeam(user, activeRole) {
  const courses = await teamCourses(user, activeRole);
  const byCoord = new Map();
  for (const c of courses) {
    const items = pendingElements(c);
    if (!items.length) continue;
    const key = c.primaryEmployeeId;
    const row = byCoord.get(key) || { userId: key, name: name(c.primaryEmployee), courses: [], items: 0, late: 0 };
    row.courses.push({ id: c.id, name: c.name, items: items.length, late: items.filter((i) => i.lateDays > 0).length });
    row.items += items.length;
    row.late += items.filter((i) => i.lateDays > 0).length;
    byCoord.set(key, row);
  }
  return Array.from(byCoord.values()).sort((a, b) => b.late - a.late || b.items - a.items);
}

/** تذكير منسق واحد أو الفريق كله: رسالة واحدة لكل منسق تجمع دوراته */
async function remindTeam(body, user, activeRole) {
  const only = body?.userId ? String(body.userId) : null;
  const note = String(body?.note || '').trim().slice(0, 500);
  const courses = (await teamCourses(user, activeRole)).filter((c) => !only || c.primaryEmployeeId === only);
  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } });
  const senderName = name(sender);
  const groups = new Map();
  let skipped = 0;
  for (const c of courses) {
    const items = pendingElements(c);
    if (!items.length) continue;
    const last = await lastReminderAt(c.id);
    if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) { skipped += 1; continue; }
    const g = groups.get(c.primaryEmployeeId) || { coordinator: c.primaryEmployee, blocks: [], courseIds: [], count: 0 };
    g.blocks.push(`دورة «${c.name}»:\n${items.map((i) => i.line).join('\n')}`);
    g.courseIds.push({ id: c.id, elements: items.map((i) => i.name) });
    g.count += items.length;
    groups.set(c.primaryEmployeeId, g);
  }
  if (!groups.size) {
    throw AppError.badRequest(skipped ? 'ذُكّر المعنيون اليوم — يُتاح تذكير جديد غداً' : 'لا عناصر معلّقة حلّ موعدها لدى فريقك', 'serverErrors.reminders.nothingPending');
  }
  for (const [coordId, g] of groups) {
    const text = [
      `تذكير من ${senderName} بالعناصر المعلّقة في دوراتك:`, '',
      g.blocks.join('\n\n'),
      note ? `\nملاحظة: ${note}` : '',
      '\nنأمل تقديمها في أقرب وقت — وإن كان التأخير خارج يدك فارفع بلاغ عائق من صفحة الدورة.',
    ].filter((x) => x !== '').join('\n');
    await deliver({
      senderId: user.id, recipientId: coordId, courseId: g.courseIds.length === 1 ? g.courseIds[0].id : null,
      subject: `تذكير: ${g.count} عنصر معلّق في ${g.courseIds.length} دورة`,
      notifTitle: `🔔 تذكير من ${senderName}: ${g.count} عنصر معلّق`,
      text,
    });
    for (const c of g.courseIds) {
      await audit.logAudit(user.id, activeRole, 'COORDINATOR_REMINDED', { courseId: c.id, elements: c.elements, note: note || null, team: true }, c.id);
    }
  }
  return { sent: groups.size, skipped, items: Array.from(groups.values()).reduce((s, g) => s + g.count, 0) };
}

/** المنسق يذكّر مشرف دورته (لا كل المشرفين) بما ينتظر اعتماده */
async function remindSupervisor(courseId, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true, name: true, courseType: true, operationalProjectId: true, primaryEmployeeId: true,
      primaryEmployee: { select: { isCollaborator: true, followUpSupervisorId: true, operationalProjectId: true } },
      closureElements: { where: { status: 'PENDING_APPROVAL' }, select: { element: { select: { name: true } } } },
    },
  });
  if (!course) throw AppError.notFound('الدورة غير موجودة', 'serverErrors.course.notFound');
  if (!(await permissions.canSubmitElement(user, activeRole, course))) {
    throw AppError.forbidden('التذكير لمنسق الدورة وفريقها', 'serverErrors.reminders.forbidden');
  }
  if (!course.closureElements.length) throw AppError.badRequest('لا عناصر بانتظار الاعتماد في هذه الدورة', 'serverErrors.reminders.nothingPending');

  // مشرف الدورة بقاعدة الصلاحيات نفسها (والخارجية لمشرف مشروع منسّقها)
  let recipients = await permissions.findCourseSupervisorIds(course);
  recipients = recipients.filter((id) => id !== user.id);
  if (!recipients.length) {
    // لا مشرف للدورة (أو المنسق نفسه مشرفها): يعتمدها المدير
    recipients = (await prisma.user.findMany({ where: { isActive: true, roles: { has: 'MANAGER' } }, select: { id: true } })).map((u) => u.id).filter((id) => id !== user.id);
  }
  const sender = await prisma.user.findUnique({ where: { id: user.id }, select: { firstName: true, lastName: true } });
  const list = course.closureElements.map((t) => `• ${t.element?.name}`).join('\n');
  const text = `تذكير من ${name(sender)}: عناصر في دورة «${course.name}» بانتظار اعتمادك:\n\n${list}`;
  for (const rid of recipients) {
    await deliver({ senderId: user.id, recipientId: rid, courseId, subject: `بانتظار اعتمادك: «${course.name}»`, notifTitle: `🔔 ${name(sender)} ينتظر اعتمادك في «${course.name}»`, text });
  }
  await audit.logAudit(user.id, activeRole, 'SUPERVISOR_REMINDED', { courseId, recipients: recipients.length }, courseId);
  return { sent: recipients.length };
}

module.exports = { pendingElements, previewCourse, remindCourse, previewTeam, remindTeam, remindSupervisor };
