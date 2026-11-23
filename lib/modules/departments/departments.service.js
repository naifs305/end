// ======================================================================
// تقييم صعوبات الإقفال، ومؤشر أداء الإدارات، ومساعد التنفيذ
// ----------------------------------------------------------------------
// بعد إقفال الدورة يسجّل منسقها ما واجهه من الإدارات الأخرى: الإدارة،
// ونوع الصعوبة، وأثرها، وأيام التأخير، وموضعها إن كانت في مقر التنفيذ،
// وكيف تجاوزها. والصعوبة الجديدة التي يكتبها بنفسه تُحفظ في قائمة الصعوبات
// فتصير خياراً لكل منسق بعده — فالقائمة تنمو مع كل إقفال.
//
// ومن مجموع التقييمات (ومعها بلاغات العوائق المنسوبة لكل إدارة):
//   المؤشر = ١٠٠ × (١ − الصعوبات المرجّحة بأثرها ÷ عدد الدورات المقيَّمة)
// الوزن: بسيط ٠٫٥، متوسط ١، كبير ١٫٥، وبلاغ العائق ٠٫٥.
//
// و«مساعد التنفيذ» يعرض لكل المنسقين ما واجهه زملاؤهم مرتّباً بالإدارة
// والمقر، مع ما تجاوزوه به.
// ======================================================================
const crypto = require('crypto');
const prisma = require('../../db/prisma');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const { DEPARTMENTS, IMPACTS, department, issueLabel, impactOf, BLOCKER_REASON_DEPARTMENT } = require('./catalog');

const CLOSED = ['CLOSED', 'ARCHIVED'];
const BLOCKER_WEIGHT = 0.5;
const NEW_ISSUE = 'new';

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

const tidy = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = (v) => tidy(v, 200).replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

// ── قائمة الصعوبات: الثابتة ومعها ما أضافه المنسقون ─────────────
async function customTypes() {
  return prisma.issueType.findMany({ where: { isActive: true }, orderBy: [{ usageCount: 'desc' }, { createdAt: 'asc' }] });
}

/** القائمة كاملة كما تُعرض للمنسق: «أخرى» آخر كل إدارة */
function mergeCatalog(custom) {
  return DEPARTMENTS.map((d) => {
    const base = d.issues.filter((i) => i.key !== 'other');
    const added = custom.filter((c) => c.department === d.key).map((c) => ({ key: c.key, label: c.label, custom: true, uses: c.usageCount }));
    return { key: d.key, name: d.name, short: d.short, location: !!d.location, issues: [...base, ...added, { key: 'other', label: 'أخرى' }] };
  });
}

/** دالة تسمية تعرف الصعوبات المضافة أيضاً */
function labeler(custom) {
  const map = new Map(custom.map((c) => [c.key, c.label]));
  return (dep, key) => map.get(key) || issueLabel(dep, key);
}

async function loadCourse(courseId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, name: true, status: true, primaryEmployeeId: true, operationalProjectId: true, endDate: true, city: true, locationType: true },
  });
  if (!course) throw httpError(404, 'الدورة غير موجودة', 'serverErrors.course.notFound');
  return course;
}

async function canReview(course, actor) {
  if (actor.activeRole === 'MANAGER') return true;
  if (actor.activeRole === 'PROJECT_SUPERVISOR') return permissions.supervisesCourse(actor.user.id, course);
  return course.primaryEmployeeId === actor.user.id;
}

const presentIssue = (i, labelOf) => ({
  id: i.id, department: i.department, issueType: i.issueType, impact: i.impact, delayDays: i.delayDays, note: i.note,
  resolution: i.resolution || null, country: i.country || null, city: i.city || null, venue: i.venue || null,
  departmentName: department(i.department)?.name || i.department, issueLabel: labelOf(i.department, i.issueType),
});

async function getReview(courseId, actor) {
  const course = await loadCourse(courseId);
  if (!(await permissions.canViewCourse(actor.user, actor.activeRole, course))) throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  const [review, custom] = await Promise.all([
    prisma.closureReview.findUnique({ where: { courseId }, include: { issues: { orderBy: { createdAt: 'asc' } } } }),
    customTypes(),
  ]);
  const labelOf = labeler(custom);
  return {
    eligible: CLOSED.includes(course.status),
    canEdit: CLOSED.includes(course.status) && (await canReview(course, actor)),
    course: { city: course.city, external: course.locationType === 'external' },
    review: review ? { noIssues: review.noIssues, note: review.note, updatedAt: review.updatedAt, issues: review.issues.map((i) => presentIssue(i, labelOf)) } : null,
    catalog: { departments: mergeCatalog(custom), impacts: IMPACTS.map(({ key, label }) => ({ key, label })) },
  };
}

/** تنظيف ما يرسله المنسق — customKeys: مفاتيح الصعوبات المضافة المعروفة */
function cleanIssues(list, customKeys = new Set()) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 40).map((x) => {
    const dep = department(x?.department);
    if (!dep) return null;
    let type = null;
    let newLabel = null;
    if (x?.issueType === NEW_ISSUE) {
      newLabel = tidy(x?.newLabel, 120);
      if (newLabel.length < 4) return null;
      type = NEW_ISSUE;
    } else if (dep.issues.some((i) => i.key === x?.issueType) || customKeys.has(x?.issueType)) {
      type = x.issueType;
    }
    if (!type) return null;
    const d = Number(String(x?.delayDays ?? '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
    return {
      department: dep.key,
      issueType: type,
      ...(newLabel ? { newLabel } : {}),
      impact: IMPACTS.some((i) => i.key === x?.impact) ? x.impact : 'MEDIUM',
      delayDays: Number.isFinite(d) && String(x?.delayDays ?? '').trim() !== '' ? Math.max(0, Math.min(365, Math.round(d))) : null,
      note: tidy(x?.note, 500) || null,
      resolution: tidy(x?.resolution, 500) || null,
      country: dep.location ? (tidy(x?.country, 80) || null) : null,
      city: dep.location ? (tidy(x?.city, 80) || null) : null,
      venue: dep.location ? (tidy(x?.venue, 120) || null) : null,
    };
  }).filter(Boolean);
}

/** الصعوبة الجديدة تُضاف للقائمة (أو تُستعمل إن سبق أن كتبها غيره بالنص نفسه) */
async function resolveNewTypes(tx, issues, custom, userId) {
  for (const i of issues) {
    if (i.issueType !== NEW_ISSUE) continue;
    const same = custom.find((c) => c.department === i.department && norm(c.label) === norm(i.newLabel))
      || DEPARTMENTS.find((d) => d.key === i.department).issues.find((s) => norm(s.label) === norm(i.newLabel));
    if (same) { i.issueType = same.key; } else {
      const key = `c_${crypto.randomBytes(5).toString('hex')}`;
      const created = await tx.issueType.create({ data: { department: i.department, key, label: i.newLabel, createdById: userId } });
      custom.push(created);
      i.issueType = created.key;
    }
    delete i.newLabel;
  }
}

async function saveReview(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  if (!CLOSED.includes(course.status)) throw httpError(400, 'يُقيَّم الإقفال بعد إقفال الدورة', 'serverErrors.review.notClosed');
  if (!(await canReview(course, actor))) throw httpError(403, 'التقييم لمنسق الدورة أو من يشرف عليها', 'serverErrors.common.forbidden');
  const custom = await customTypes();
  const issues = cleanIssues(dto?.issues, new Set(custom.map((c) => c.key)));
  const noIssues = !!dto?.noIssues && issues.length === 0;
  if (!noIssues && issues.length === 0) throw httpError(400, 'اختر «لم تواجهني صعوبات» أو سجّل صعوبة واحدة على الأقل', 'serverErrors.review.empty');
  const note = tidy(dto?.note, 1000) || null;

  await prisma.$transaction(async (tx) => {
    await resolveNewTypes(tx, issues, custom, actor.user.id);
    const review = await tx.closureReview.upsert({
      where: { courseId },
      create: { courseId, authorId: actor.user.id, noIssues, note },
      update: { authorId: actor.user.id, noIssues, note },
    });
    await tx.departmentIssue.deleteMany({ where: { reviewId: review.id } });
    if (issues.length) await tx.departmentIssue.createMany({ data: issues.map((i) => ({ ...i, reviewId: review.id, courseId })) });
    // شيوع الصعوبة المضافة: الأكثر استعمالاً يُعرض أولاً
    const used = [...new Set(issues.map((i) => i.issueType).filter((k) => k.startsWith('c_')))];
    if (used.length) await tx.issueType.updateMany({ where: { key: { in: used } }, data: { usageCount: { increment: 1 } } });
  });
  await audit.logAudit(actor.user.id, actor.activeRole, 'CLOSURE_REVIEW_SAVED', { courseId, issues: issues.length, noIssues }, courseId);
  return getReview(courseId, actor);
}

// ── لوحة أداء الإدارات ──────────────────────────────────────
/**
 * صعوبة «تغيير نوع الشهادة بعد اعتماده» من بيانات الدورة نفسها.
 * أثرها كبير إن وقعت قبل البداية بأقل من ثلاثة أيام أو بعدها.
 */
function certificateChangeIssues(courses, existingCourseIds = new Set()) {
  return courses
    .filter((c) => c.certificateTypeChangedAt && !existingCourseIds.has(c.id))
    .map((c) => {
      const daysBefore = (new Date(c.startDate) - new Date(c.certificateTypeChangedAt)) / 86400000;
      return {
        id: `auto-cert-${c.id}`,
        courseId: c.id,
        department: 'program_design',
        issueType: 'cert_type_changed',
        impact: daysBefore < 3 ? 'HIGH' : 'MEDIUM',
        delayDays: null,
        note: c.certificateTypeChangeCount > 1 ? `تغيّر ${c.certificateTypeChangeCount} مرات` : null,
        resolution: null,
        createdAt: c.certificateTypeChangedAt,
        automatic: true,
      };
    });
}

function periodRange(period, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth();
  if (period === 'month') return { from: new Date(y, m, 1), to: now };
  if (period === 'quarter') return { from: new Date(y, Math.floor(m / 3) * 3, 1), to: now };
  if (period === 'year') return { from: new Date(y, 0, 1), to: now };
  return { from: new Date(2000, 0, 1), to: now };
}

const round1 = (n) => Math.round(n * 10) / 10;

/** يحسب المؤشرات من صفوف خام — منفصل ليُختبر دون قاعدة بيانات */
function aggregate({ reviews, issues, blockers, now = new Date(), labelOf = issueLabel }) {
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
      topIssue: top ? { label: labelOf(d.key, top[0]), count: top[1] } : null,
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
      return { department: department(dep)?.short || dep, label: labelOf(dep, type), count };
    }),
    trend: months,
  };
}

async function courseNames(ids) {
  const rows = await prisma.course.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true } });
  return new Map(rows.map((c) => [c.id, c.name]));
}

async function dashboard(period, actor) {
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(actor.activeRole)) throw httpError(403, 'لوحة أداء الإدارات للمدير والمشرفين', 'serverErrors.common.forbidden');
  const { from, to } = periodRange(period);
  const [reviews, recorded, blockers, custom, certChanges] = await Promise.all([
    prisma.closureReview.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { courseId: true, noIssues: true, createdAt: true } }),
    prisma.departmentIssue.findMany({ where: { createdAt: { gte: from, lte: to } }, orderBy: { createdAt: 'desc' } }),
    prisma.elementBlocker.findMany({ where: { raisedAt: { gte: from, lte: to } }, select: { reason: true, courseId: true } }),
    customTypes(),
    prisma.course.findMany({
      where: { certificateTypeChangedAt: { gte: from, lte: to } },
      select: { id: true, startDate: true, certificateTypeChangedAt: true, certificateTypeChangeCount: true },
    }),
  ]);
  // تغيير نوع الشهادة بعد اعتماده يُسجَّل على إدارة التصميم تلقائياً، بلا انتظار تقييم المنسق
  const alreadyRecorded = new Set(recorded.filter((i) => i.department === 'program_design' && i.issueType === 'cert_type_changed').map((i) => i.courseId));
  const issues = [...recorded, ...certificateChangeIssues(certChanges, alreadyRecorded)]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const labelOf = labeler(custom);
  const out = aggregate({ reviews, issues, blockers, labelOf });
  const recent = issues.slice(0, 15);
  const names = await courseNames(recent.map((i) => i.courseId));
  out.recent = recent.map((i) => ({ ...presentIssue(i, labelOf), courseId: i.courseId, courseName: names.get(i.courseId) || '', createdAt: i.createdAt, impactLabel: impactOf(i.impact).label }));
  out.period = { key: period, from, to };
  return out;
}

// ── مساعد التنفيذ: خبرة الزملاء مرتّبة — لكل المنسقين ─────────
/** يرتّب الصعوبات بالإدارة ثم النوع، والمكانية بالدولة ثم المدينة ثم المقر */
function organize(issues, { labelOf = issueLabel, names = new Map() } = {}) {
  const byDep = new Map();
  for (const i of issues) {
    const depKey = i.department;
    if (!byDep.has(depKey)) byDep.set(depKey, new Map());
    const types = byDep.get(depKey);
    if (!types.has(i.issueType)) types.set(i.issueType, []);
    types.get(i.issueType).push(i);
  }
  const ex = (i) => ({
    note: i.note || null, resolution: i.resolution || null, impact: impactOf(i.impact).label, delayDays: i.delayDays,
    place: [i.venue, i.city, i.country].filter(Boolean).join('، ') || null, courseName: names.get(i.courseId) || '', courseId: i.courseId, date: i.createdAt,
  });
  const departments = [...byDep.entries()].map(([key, types]) => {
    const list = [...types.entries()].map(([type, rows]) => {
      const sorted = [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const delays = rows.map((r) => r.delayDays).filter((x) => Number.isFinite(x));
      return {
        key: type, label: labelOf(key, type), count: rows.length,
        high: rows.filter((r) => r.impact === 'HIGH').length,
        avgDelay: delays.length ? round1(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
        lastAt: sorted[0].createdAt,
        resolutions: sorted.filter((r) => r.resolution).slice(0, 4).map(ex),
        examples: sorted.filter((r) => r.note || r.resolution || r.city).slice(0, 4).map(ex),
      };
    }).sort((a, b) => b.count - a.count);
    return { key, name: department(key)?.name || key, total: sumCounts(list), types: list };
  }).sort((a, b) => b.total - a.total);

  const locMap = new Map();
  for (const i of issues.filter((x) => x.city || x.country || x.venue)) {
    const k = `${i.country || '—'}|${i.city || '—'}`;
    if (!locMap.has(k)) locMap.set(k, { country: i.country || null, city: i.city || null, venues: new Map(), count: 0 });
    const loc = locMap.get(k);
    loc.count += 1;
    const v = i.venue || 'مقر غير مسمّى';
    if (!loc.venues.has(v)) loc.venues.set(v, []);
    loc.venues.get(v).push(i);
  }
  const locations = [...locMap.values()].map((l) => ({
    country: l.country, city: l.city, count: l.count,
    venues: [...l.venues.entries()].map(([venue, rows]) => {
      const t = {};
      rows.forEach((r) => { const lab = labelOf(r.department, r.issueType); t[lab] = (t[lab] || 0) + 1; });
      return {
        venue, count: rows.length,
        issues: Object.entries(t).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
        tips: rows.filter((r) => r.resolution).slice(0, 3).map((r) => r.resolution),
      };
    }).sort((a, b) => b.count - a.count),
  })).sort((a, b) => b.count - a.count);

  return { departments, locations };
}
const sumCounts = (list) => list.reduce((a, t) => a + t.count, 0);

async function knowledge(query) {
  const where = {};
  if (query.department && department(query.department)) where.department = query.department;
  if (query.country) where.country = tidy(query.country, 80);
  if (query.city) where.city = tidy(query.city, 80);
  const [issues, custom, places] = await Promise.all([
    prisma.departmentIssue.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 }),
    customTypes(),
    prisma.departmentIssue.findMany({ where: { OR: [{ country: { not: null } }, { city: { not: null } }] }, select: { country: true, city: true }, distinct: ['country', 'city'] }),
  ]);
  const labelOf = labeler(custom);
  const q = norm(query.q || '');
  const filtered = q
    ? issues.filter((i) => [labelOf(i.department, i.issueType), i.note, i.resolution, i.city, i.venue, i.country, department(i.department)?.name].some((t) => t && norm(t).includes(q)))
    : issues;
  const names = await courseNames(filtered.slice(0, 600).map((i) => i.courseId));
  const out = organize(filtered, { labelOf, names });
  return {
    ...out,
    stats: {
      issues: filtered.length,
      departments: out.departments.length,
      locations: out.locations.length,
      withResolution: filtered.filter((i) => i.resolution).length,
    },
    filters: {
      departments: DEPARTMENTS.map((d) => ({ key: d.key, name: d.name })),
      countries: [...new Set(places.map((p) => p.country).filter(Boolean))].sort(),
      cities: [...new Set(places.map((p) => p.city).filter(Boolean))].sort(),
    },
  };
}

/** إشعار المنسق بتقييم صعوبات الإقفال لحظة إقفال دورته */
async function notifyOnClosure(course) {
  try {
    const { createNotification } = require('../../services/notifications');
    await createNotification(
      course.primaryEmployeeId,
      'CLOSURE_REVIEW_REQUEST',
      `✅ أُقفلت دورة «${course.name}» — قيّم صعوبات الإقفال`,
      'سجّل في دقيقة ما واجهته من الإدارات الأخرى حتى أقفلت الدورة (تأخر الأسماء، معلومات المدربين…)، أو اختر «لم تواجهني صعوبات». تقييمك يبني مؤشر أداء الإدارات، وينفع زملاءك في «مساعد التنفيذ».',
      { courseId: course.id, courseName: course.name },
    );
  } catch { /* الإشعار لا يُعطّل الإقفال */ }
}

module.exports = {
  certificateChangeIssues,
  NEW_ISSUE, getReview, saveReview, dashboard, knowledge, aggregate, organize, cleanIssues, mergeCatalog, periodRange, notifyOnClosure,
};
