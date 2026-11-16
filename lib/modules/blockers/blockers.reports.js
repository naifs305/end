// =============================================================
// تقارير بلاغات العوائق
// -------------------------------------------------------------
// البلاغ لا يُتحقَّق منه حالةً بحالة — لا بمرفق ولا بتأكيد مُراجِع.
// يُتحقَّق منه بأمرين لا يحتاجان جهداً بشرياً:
//   ١. القائمة الأسبوعية: تصل الجهة المنتظَرة بالاسم، فتعترض إن
//      كان الادّعاء باطلاً. الخصم هو الحارس، لا المُراجِع.
//   ٢. المقارنة والفحص المتقاطع: منسق يبلّغ في ٩ من ١٠ دورات
//      وزملاؤه في ١ من ١٠ مفضوح بالأرقام وحدها. والمدرب نفسه في
//      دورة منسق آخر — هل تأخر عنده أيضاً؟
// =============================================================
const repo = require('./blockers.repo');
const { REASON_LABELS } = require('./blockers.service');

const MS_HOUR = 3600000;

function hoursBetween(from, to) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_HOUR));
}

function normalizeParty(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * القائمة الأسبوعية — مجمّعة بالجهة المنتظَرة.
 * تُرسل بالبريد إلى الجهة المتأخرة (المدربون أو تطوير الأعمال).
 * المنصة للعمليات وحدها، فلا يُمنح أحد من خارجها حساباً — القائمة
 * تصلهم بالبريد لا بالدخول.
 */
async function buildWeeklyList(now = new Date()) {
  const open = await repo.listOpenBlockers();

  const groups = new Map();

  for (const b of open) {
    const key = normalizeParty(b.awaitedParty);
    if (!groups.has(key)) {
      groups.set(key, {
        party: b.awaitedParty,
        reasons: new Set(),
        items: [],
        oldestHours: 0,
      });
    }
    const g = groups.get(key);
    const waitingHours = hoursBetween(b.raisedAt, now);
    g.reasons.add(b.reason);
    g.oldestHours = Math.max(g.oldestHours, waitingHours);
    g.items.push({
      blockerId: b.id,
      courseName: b.course?.name || '',
      courseCode: b.course?.code || '',
      elementName: b.tracking?.element?.name || '',
      reason: b.reason,
      reasonLabel: REASON_LABELS[b.reason] || b.reason,
      details: b.details,
      raisedAt: b.raisedAt,
      waitingHours,
      waitingDays: Math.floor(waitingHours / 24),
      coordinator: b.raisedBy
        ? `${b.raisedBy.firstName || ''} ${b.raisedBy.lastName || ''}`.trim()
        : '',
    });
  }

  const list = [...groups.values()]
    .map((g) => ({
      party: g.party,
      count: g.items.length,
      oldestDays: Math.floor(g.oldestHours / 24),
      reasons: [...g.reasons].map((r) => REASON_LABELS[r] || r),
      items: g.items.sort((a, b) => b.waitingHours - a.waitingHours),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    generatedAt: now,
    totalOpen: open.length,
    partiesCount: list.length,
    groups: list,
  };
}

/**
 * المقارنة بين المنسقين + الفحص المتقاطع.
 * لا تُثبت كذب بلاغ بعينه — تكشف النمط، وهو ما لا يكشفه التحقق.
 */
async function buildComparisonReport(from, to) {
  const [blockers, courseCounts] = await Promise.all([
    repo.listForComparison(from, to),
    repo.countCoursesByEmployee(from, to),
  ]);

  const coursesByEmployee = new Map(
    courseCounts.map((c) => [c.primaryEmployeeId, c._count._all]),
  );

  // ── لكل منسق ──
  const byCoordinator = new Map();
  for (const b of blockers) {
    const id = b.raisedById;
    if (!byCoordinator.has(id)) {
      byCoordinator.set(id, {
        userId: id,
        name: `${b.raisedBy?.firstName || ''} ${b.raisedBy?.lastName || ''}`.trim(),
        operationalProjectId: b.raisedBy?.operationalProjectId || null,
        total: 0,
        credited: 0,
        rejected: 0,
        byReason: {},
        courses: new Set(),
      });
    }
    const c = byCoordinator.get(id);
    c.total += 1;
    if (b.isCredited) c.credited += 1;
    if (b.credit === 'MANAGER_REJECTED') c.rejected += 1;
    c.byReason[b.reason] = (c.byReason[b.reason] || 0) + 1;
    c.courses.add(b.courseId);
  }

  const coordinators = [...byCoordinator.values()].map((c) => {
    const coursesCreated = coursesByEmployee.get(c.userId) || 0;
    return {
      userId: c.userId,
      name: c.name,
      operationalProjectId: c.operationalProjectId,
      blockersTotal: c.total,
      blockersCredited: c.credited,
      blockersRejected: c.rejected,
      coursesWithBlockers: c.courses.size,
      coursesCreated,
      // النسبة التي تكشف النمط: كم دورة من دوراته فيها بلاغ؟
      blockedCoursesRate: coursesCreated > 0
        ? Math.round((c.courses.size / coursesCreated) * 100)
        : null,
      byReason: Object.entries(c.byReason).map(([reason, count]) => ({
        reason,
        reasonLabel: REASON_LABELS[reason] || reason,
        count,
      })),
    };
  });

  // المتوسط العام — مرجع المقارنة
  const rated = coordinators.filter((c) => c.blockedCoursesRate != null);
  const averageRate = rated.length
    ? Math.round(rated.reduce((s, c) => s + c.blockedCoursesRate, 0) / rated.length)
    : 0;

  // مَن يبتعد عن المتوسط بفارق كبير — موضع نظر لا تهمة
  const outliers = coordinators
    .filter((c) => c.blockedCoursesRate != null
      && c.coursesCreated >= 3
      && c.blockedCoursesRate >= Math.max(50, averageRate * 2))
    .sort((a, b) => b.blockedCoursesRate - a.blockedCoursesRate);

  // ── الفحص المتقاطع: الجهة نفسها عند منسقين مختلفين ──
  const byParty = new Map();
  for (const b of blockers) {
    const key = normalizeParty(b.awaitedParty);
    if (!byParty.has(key)) {
      byParty.set(key, { party: b.awaitedParty, coordinators: new Set(), count: 0, reasons: new Set() });
    }
    const p = byParty.get(key);
    p.coordinators.add(b.raisedById);
    p.reasons.add(b.reason);
    p.count += 1;
  }

  const parties = [...byParty.values()]
    .map((p) => ({
      party: p.party,
      count: p.count,
      coordinatorsCount: p.coordinators.size,
      reasons: [...p.reasons].map((r) => REASON_LABELS[r] || r),
      // جهة شكا منها منسق واحد فقط ومراراً — تستحق سؤالاً.
      // وجهة شكا منها عدة منسقين — الشكوى مؤكَّدة وتستحق تصعيداً.
      corroborated: p.coordinators.size > 1,
    }))
    .sort((a, b) => b.count - a.count);

  // ── ملخص الأسباب — الورقة التي تُرفع للقيادة ──
  const reasonTotals = {};
  for (const b of blockers) {
    reasonTotals[b.reason] = (reasonTotals[b.reason] || 0) + 1;
  }

  const reasons = Object.entries(reasonTotals)
    .map(([reason, count]) => ({
      reason,
      reasonLabel: REASON_LABELS[reason] || reason,
      count,
      share: blockers.length ? Math.round((count / blockers.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // متوسط مدة التعطيل لكل سبب — كم يكلّفنا كل طرف من وقت
  const durations = {};
  for (const b of blockers) {
    if (!b.resolvedAt) continue;
    const h = hoursBetween(b.raisedAt, b.resolvedAt);
    if (!durations[b.reason]) durations[b.reason] = [];
    durations[b.reason].push(h);
  }
  const avgDurations = Object.entries(durations).map(([reason, arr]) => ({
    reason,
    reasonLabel: REASON_LABELS[reason] || reason,
    avgHours: Math.round(arr.reduce((s, x) => s + x, 0) / arr.length),
    avgDays: Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) / 24),
    samples: arr.length,
  })).sort((a, b) => b.avgHours - a.avgHours);

  return {
    range: { from, to },
    totalBlockers: blockers.length,
    reasons,
    avgDurations,
    coordinators: coordinators.sort((a, b) => b.blockersTotal - a.blockersTotal),
    averageBlockedCoursesRate: averageRate,
    outliers,
    parties,
  };
}

module.exports = {
  buildWeeklyList,
  buildComparisonReport,
};
