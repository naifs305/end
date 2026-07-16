// GET /api/kpis/my-supervisor-stats
// للمشرف نفسه — يعرض أداءه في البت على العناصر وعدد العناصر المعلّقة عنده
const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const userId = req.user.id;

  // تحقق أن المستخدم مشرف أو مدير
  const isSupervisor = req.user.roles?.includes('PROJECT_SUPERVISOR');
  const isManager    = req.user.roles?.includes('MANAGER');
  if (!isSupervisor && !isManager) {
    return res.status(403).json({ message: 'غير مصرح' });
  }

  const now = new Date();

  // ── إحصائيات البت السابق (كل الوقت) ──
  const decisions = await prisma.courseClosureTracking.findMany({
    where: {
      decidedById: userId,
      status: { in: ['APPROVED', 'REJECTED', 'RETURNED'] },
      decisionAt: { not: null },
    },
    select: {
      status: true,
      executionAt: true,
      decisionAt:  true,
    },
  });

  let totalDecisions = decisions.length;
  let approved = 0, returned = 0, rejected = 0;
  let waitHoursSum = 0, waitCount = 0;

  for (const d of decisions) {
    if (d.status === 'APPROVED') approved++;
    if (d.status === 'RETURNED') returned++;
    if (d.status === 'REJECTED') rejected++;
    if (d.executionAt && d.decisionAt) {
      const wait = (new Date(d.decisionAt) - new Date(d.executionAt)) / 3600000;
      if (wait >= 0) { waitHoursSum += wait; waitCount++; }
    }
  }

  const avgResponseHours = waitCount ? Math.round((waitHoursSum / waitCount) * 10) / 10 : null;

  // ── العناصر المعلّقة التي تنتظر البت منه ──
  // المشرف يبتّ في عناصر موظفي مشروعه
  let projectIds = [];
  if (isSupervisor) {
    const sup = await prisma.projectSupervisor.findMany({
      where: { userId },
      select: { operationalProjectId: true },
    });
    projectIds = sup.map(s => s.operationalProjectId);
  }

  // المدير يرى كل العناصر
  const employeeWhere = isManager
    ? { isActive: true, roles: { has: 'EMPLOYEE' } }
    : { isActive: true, operationalProjectId: { in: projectIds } };

  const employees = await prisma.user.findMany({
    where: employeeWhere,
    select: { id: true },
  });
  const employeeIds = employees.map(e => e.id);

  const pending = await prisma.courseClosureTracking.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      executedById: { in: employeeIds },
    },
    select: {
      id: true,
      executionAt: true,
      element: { select: { name: true, key: true } },
      course: { select: { id: true, name: true } },
      executedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // تصنيف العناصر المعلّقة حسب عمرها
  const pendingWithAge = pending.map(p => {
    const ageHours = p.executionAt
      ? (now.getTime() - new Date(p.executionAt).getTime()) / 3600000
      : 0;
    return { ...p, ageHours: Math.round(ageHours * 10) / 10 };
  }).sort((a, b) => b.ageHours - a.ageHours);

  const urgent   = pendingWithAge.filter(p => p.ageHours >= 72);   // +3 أيام
  const moderate = pendingWithAge.filter(p => p.ageHours >= 24 && p.ageHours < 72); // يوم-3 أيام
  const fresh    = pendingWithAge.filter(p => p.ageHours < 24);    // أقل من يوم

  return res.status(200).json({
    totalDecisions,
    approved,
    returned,
    rejected,
    approvalRate: totalDecisions ? Math.round((approved / totalDecisions) * 100) : 0,
    avgResponseHours,
    responsiveness: avgResponseHours == null ? null
      : avgResponseHours < 8  ? 'سريع جداً'
      : avgResponseHours < 24 ? 'مقبول'
      : avgResponseHours < 48 ? 'بطيء'
      : 'متأخر',
    pendingTotal: pending.length,
    urgentCount:  urgent.length,
    moderateCount: moderate.length,
    freshCount:   fresh.length,
    urgentItems:  urgent.slice(0, 10), // أكبر 10 معلّقة عاجلة
  });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
