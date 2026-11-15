// ======================================================================
// تقييم صعوبات الإقفال ومؤشر أداء الإدارات
// ----------------------------------------------------------------------
// بعد إقفال الدورة يسجّل منسقها ما واجهه من الإدارات الأخرى: الإدارة،
// ونوع الصعوبة، وأثرها، وأيام التأخير. ومن مجموع التقييمات (ومعها بلاغات
// العوائق المنسوبة لكل إدارة) يُبنى مؤشر أداء لكل إدارة:
//
//   المؤشر = ١٠٠ × (١ − الصعوبات المرجّحة بأثرها ÷ عدد الدورات المقيَّمة)
//
// فإدارة لم تُسجَّل عليها صعوبة مؤشرها ١٠٠، وكلما تكررت صعوباتها أو كبر
// أثرها نزل. والوزن: بسيط ٠٫٥، متوسط ١، كبير ١٫٥، وبلاغ العائق ٠٫٥.
// ======================================================================
const prisma = require('../../db/prisma');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const { DEPARTMENTS, IMPACTS, department, issueLabel, impactOf, BLOCKER_REASON_DEPARTMENT } = require('./catalog');

const CLOSED = ['CLOSED', 'ARCHIVED'];
const BLOCKER_WEIGHT = 0.5;

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

async function loadCourse(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, status: true, primaryEmployeeId: true, operationalProjectId: true, endDate: true },
  });
  if (!course) throw httpError(404, 'الدورة غير موجودة', 'serverErrors.course.notFound');
  return course;
}

async function canReview(course, actor) {
  if (actor.activeRole === 'MANAGER') return true;
  if (actor.activeRole === 'PROJECT_SUPERVISOR') return permissions.supervisesCourse(actor.user.id, course);
  return course.primaryEmployeeId === actor.user.id;
}

const presentIssue = (i) => ({
  id: i.id, department: i.department, issueType: i.issueType, impact: i.impact, delayDays: i.delayDays, note: i.note,
  departmentName: department(i.department)?.name || i.department, issueLabel: issueLabel(i.department, i.issueType),
});

async function getReview(courseId, actor) {
  const course = await loadCourse(courseId);
  if (!(await permissions.canViewCourse(actor.user, actor.activeRole, course))) throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  const review = await prisma.closureReview.findUnique({ where: { courseId }, include: { issues: { orderBy: { createdAt: 'asc' } } } });
  return {
    eligible: CLOSED.includes(course.status),
    canEdit: CLOSED.includes(course.status) && (await canReview(course, actor)),
    review: review ? { noIssues: review.noIssues, note: review.note, updatedAt: review.updatedAt, issues: review.issues.map(presentIssue) } : null,
    catalog: { departments: DEPARTMENTS.map(({ key, name, issues }) => ({ key, name, issues })), impacts: IMPACTS.map(({ key, label }) => ({ key, label })) },
  };
}

function cleanIssues(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((x) => {
    const dep = department(x?.department);
    if (!dep) return null;
    const type = dep.issues.some((i) => i.key === x?.issueType) ? x.issueType : null;
    if (!type) return null;
    const d = Number(String(x?.delayDays ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
    return {
      department: dep.key,
      issueType: type,
      impact: IMPACTS.some((i) => i.key === x?.impact) ? x.impact : 'MEDIUM',
      delayDays: Number.isFinite(d) && String(x?.delayDays ?? '').trim() !== '' ? Math.max(0, Math.min(365, Math.round(d))) : null,
      note: String(x?.note || '').trim().slice(0, 500) || null,
    };
  }).filter(Boolean);
}

async function saveReview(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  if (!CLOSED.includes(course.status)) throw httpError(400, 'يُقيَّم الإقفال بعد إقفال الدورة', 'serverErrors.review.notClosed');
  if (!(await canReview(course, actor))) throw httpError(403, 'التقييم لمنسق الدورة أو من يشرف عليها', 'serverErrors.common.forbidden');
  const issues = cleanIssues(dto?.issues);
  const noIssues = !!dto?.noIssues && issues.length === 0;
  if (!noIssues && issues.length === 0) throw httpError(400, 'اختر «لم تواجهني صعوبات» أو سجّل صعوبة واحدة على الأقل', 'serverErrors.review.empty');
  const note = String(dto?.note || '').trim().slice(0, 1000) || null;

  await prisma.$transaction(async (tx) => {
    const review = await tx.closureReview.upsert({
      where: { courseId },
      create: { courseId, authorId: actor.user.id, noIssues, note },
      update: { authorId: actor.user.id, noIssues, note },
    });
    await tx.departmentIssue.deleteMany({ where: { reviewId: review.id } });
    if (issues.length) await tx.departmentIssue.createMany({ data: issues.map((i) => ({ ...i, reviewId: review.id, courseId })) });
  });
  await audit.logAudit(actor.user.id, actor.activeRole, 'CLOSURE_REVIEW_SAVED', { courseId, issues: issues.length, noIssues }, courseId);
  return getReview(courseId, actor);
}

// ── لوحة أداء الإدارات ──────────────────────────────────────
function periodRange(period, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth();
  if (period === 'month') return { from: new Date(y, m, 1), to: now };
  if (period === 'quarter') return { from: new Date(y, Math.floor(m / 3) * 3, 1), to: now };
  if (period === 'year') return { from: new Date(y, 0, 1), to: now };
  return { from: new Date(2000, 0, 1), to: now };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** يحسب المؤشرات من صفوف خام — منفصل ليُختبر دون قاعدة بيانات */
function aggregate({ reviews, issues, blockers, now = new Date() }) {
  const N = reviews.length;
  const deps = DEPARTMENTS.map((d) => {
    const own = issues.filter((i) => i.department === d.key);
    const blk = blockers.filter((b) => BLOCKER_REASON_DEPARTMENT[b.reason] === d.key);
    const weighted = own.reduce((a, i) => a + impactOf(i.impact).weight, 0) + blk.length * BLOCKER_WEIGHT;
    const delays = own.map((i) => i.delayDays).filter((x) => Number.isFinite(x));
    const typeCount = {};
    own.forEach((i) => { typeCount[i.issueType] = (typeCount[i.issueType] || 0) + 1; });
    const top = Object.entries(typeCount).sort((a, b) => b[1] - a[1])[0];
    return {
      key: d.key, name: d.name, short: d.short,
      issues: own.length,
      blockers: blk.length,
      courses: new Set([...own.map((i) => i.courseId), ...blk.map((b) => b.courseId)]).size,
      high: own.filter((i) => i.impact === 'HIGH').length,
      avgDelay: delays.length ? round1(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
      topIssue: top ? { label: issueLabel(d.key, top[0]), count: top[1] } : null,
      index: N ? Math.max(0, Math.round(100 * (1 - Math.min(1, weighted / N)))) : null,
    };
  }).sort((a, b) => (a.index ?? 101) - (b.index ?? 101) || b.issues - a.issues);

  const allDelays = issues.map((i) => i.delayDays).filter((x) => Number.isFinite(x));
  const types = {};
  issues.forEach((i) => { const k = `${i.department}:${i.issueType}`; types[k] = (types[k] || 0) + 1; });
  const months = [];
  for (let k = 11; k >= 0; k -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    months.push({
      label: d.toLocaleDateString('ar-SA-u-ca-gregory', { month: 'short' }),
      issues: issues.filter((i) => new Date(i.createdAt) >= d && new Date(i.createdAt) < next).length,
      reviews: reviews.filter((r) => new Date(r.createdAt) >= d && new Date(r.createdAt) < next).length,
    });
  }
  const indexed = deps.filter((d) => d.index !== null);
  return {
    totals: {
      reviewed: N,
      withIssues: reviews.filter((r) => !r.noIssues).length,
      issues: issues.length,
      blockers: blockers.filter((b) => BLOCKER_REASON_DEPARTMENT[b.reason]).length,
      avgDelay: allDelays.length ? round1(allDelays.reduce((a, b) => a + b, 0) / allDelays.length) : null,
      avgIndex: indexed.length ? Math.round(indexed.reduce((a, d) => a + d.index, 0) / indexed.length) : null,
    },
    departments: deps,
    topIssues: Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, count]) => {
      const [dep, type] = k.split(':');
      return { department: department(dep)?.short || dep, label: issueLabel(dep, type), count };
    }),
    trend: months,
  };
}

async function dashboard(period, actor) {
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(actor.activeRole)) throw httpError(403, 'لوحة أداء الإدارات للمدير والمشرفين', 'serverErrors.common.forbidden');
  const { from, to } = periodRange(period);
  const [reviews, issues, blockers] = await Promise.all([
    prisma.closureReview.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { courseId: true, noIssues: true, createdAt: true } }),
    prisma.departmentIssue.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' } }),
    prisma.elementBlocker.findMany({ where: { raisedAt: { gte: from, lte: to } }, select: { reason: true, courseId: true } }),
  ]);
  const out = aggregate({ reviews, issues, blockers });
  // أحدث الملاحظات بأسماء دوراتها
  const recent = issues.slice(0, 15);
  const names = new Map((await prisma.course.findMany({ where: { id: { in: [...new Set(recent.map((i) => i.courseId))] } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  out.recent = recent.map((i) => ({ ...presentIssue(i), courseId: i.courseId, courseName: names.get(i.courseId) || '', createdAt: i.createdAt, impactLabel: impactOf(i.impact).label }));
  out.period = { key: period, from, to };
  return out;
}

/** إشعار المنسق بتقييم صعوبات الإقفال لحظة إقفال دورته */
async function notifyOnClosure(course) {
  try {
    const { createNotification } = require('../../services/notifications');
    await createNotification(
      course.primaryEmployeeId,
      'CLOSURE_REVIEW_REQUEST',
      `✅ أُقفلت دورة «${course.name}» — قيّم صعوبات الإقفال`,
      'سجّل في دقيقة ما واجهته من الإدارات الأخرى حتى أقفلت الدورة (تأخر الأسماء، معلومات المدربين…)، أو اختر «لم تواجهني صعوبات». تقييمك يبني مؤشر أداء الإدارات.',
      { courseId: course.id, courseName: course.name },
    );
  } catch { /* الإشعار لا يُعطّل الإقفال */ }
}

module.exports = { getReview, saveReview, dashboard, aggregate, cleanIssues, periodRange, notifyOnClosure };
