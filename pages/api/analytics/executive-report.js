// GET /api/analytics/executive-report?year=2026&month=5
// تقرير قيادي شهري — مدير ومشرف مشروع
const prisma = require('../../../lib/db/prisma');
const { withManagerOrSupervisor, withMethods, ok } = require('../../../lib/server/http');
const permissions = require('../../../lib/services/permissions');

async function handler(req, res) {
  const year  = Number(req.query.year  || new Date().getFullYear());
  const month = Number(req.query.month || new Date().getMonth() + 1);

  const start = new Date(year, month - 1, 1, 0, 0, 0);
  const end   = new Date(year, month, 0, 23, 59, 59, 999);
  const periodLabel = `${year}-${String(month).padStart(2,'0')}`;

  const courseWhere = await permissions.buildCoursesWhere(req.user, req.activeRole, {});

  // ── جلب البيانات بالتوازي ──────────────────────────────────
  const [
    totalCourses,
    newCourses,
    closedInPeriod,
    pendingElements,
    overdueNotClosed,
    kpiSnapshots,
    allElements,
    users,
  ] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.course.count({ where: { ...courseWhere, createdAt: { gte: start, lte: end } } }),
    prisma.course.count({ where: { ...courseWhere, status: { in: ['CLOSED','ARCHIVED'] }, updatedAt: { gte: start, lte: end } } }),
    prisma.courseClosureTracking.count({ where: { status: 'PENDING_APPROVAL', course: courseWhere } }),
    prisma.course.count({ where: { ...courseWhere, endDate: { lt: new Date() }, status: { notIn: ['CLOSED','ARCHIVED'] } } }),
    prisma.employeeKpiSnapshot.findMany({
      where: { periodType: 'MONTHLY', periodLabel },
      include: { user: { select: { id:true, firstName:true, lastName:true, operationalProject:{ select:{ name:true } } } } },
      orderBy: { finalScore: 'desc' },
    }),
    prisma.courseClosureTracking.findMany({
      where: { course: courseWhere },
      select: { status: true },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id:true, roles:true } }),
  ]);

  // ── احصائيات العناصر ───────────────────────────────────────
  const elementStats = allElements.reduce((acc, el) => {
    acc[el.status] = (acc[el.status] || 0) + 1;
    return acc;
  }, {});

  const totalEl    = allElements.length;
  const approvedEl = elementStats.APPROVED        || 0;
  const pendingEl  = elementStats.PENDING_APPROVAL || 0;
  const notStarted = elementStats.NOT_STARTED      || 0;
  const returnedEl = elementStats.RETURNED         || 0;
  const completionRate = totalEl > 0 ? Math.round((approvedEl / totalEl) * 100) : 0;

  // ── KPI ───────────────────────────────────────────────────
  const activeSnaps = kpiSnapshots.filter(s => s.isSubjectToEvaluation !== false);
  const avgScore = activeSnaps.length
    ? activeSnaps.reduce((s, x) => s + Number(x.finalScore || 0), 0) / activeSnaps.length
    : 0;

  const levelCounts = activeSnaps.reduce((acc, s) => {
    acc[s.performanceLevel] = (acc[s.performanceLevel] || 0) + 1;
    return acc;
  }, {});

  const top3 = activeSnaps.slice(0, 3).map(s => ({
    name:  `${s.user?.firstName} ${s.user?.lastName}`,
    project: s.user?.operationalProject?.name || '-',
    score: Number(s.finalScore || 0).toFixed(1),
    level: s.performanceLevelLabel || s.performanceLevel,
  }));

  const needsAttention = activeSnaps.filter(s => Number(s.finalScore) < 60).map(s => ({
    name:  `${s.user?.firstName} ${s.user?.lastName}`,
    project: s.user?.operationalProject?.name || '-',
    score: Number(s.finalScore || 0).toFixed(1),
  }));

  // ── المستخدمون ────────────────────────────────────────────
  const employees  = users.filter(u => u.roles.includes('EMPLOYEE')).length;
  const supervisors = users.filter(u => u.roles.includes('PROJECT_SUPERVISOR')).length;

  return ok(res, {
    period:      { year, month, label: periodLabel, start: start.toISOString(), end: end.toISOString() },
    courses:     { total: totalCourses, newThisPeriod: newCourses, closedThisPeriod: closedInPeriod, overdueNotClosed },
    elements:    { total: totalEl, approved: approvedEl, pending: pendingEl, notStarted, returned: returnedEl, completionRate },
    kpi:         { avgScore: avgScore.toFixed(1), activeEmployees: activeSnaps.length, levelCounts, top3, needsAttention },
    team:        { employees, supervisors },
    generatedAt: new Date().toISOString(),
  });
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
