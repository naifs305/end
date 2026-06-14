// GET /api/kpis/supervisor-performance?periodType=MONTHLY&periodLabel=2026-05
// للمدير فقط — يُظهر أداء كل مشرف في سرعة البت والاعتمادات
const prisma = require('../../../lib/db/prisma');
const { withManager, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const { periodLabel, periodType = 'MONTHLY' } = req.query;

  // تحديد نطاق الفترة
  let start, end;
  if (periodLabel) {
    if (periodType === 'MONTHLY') {
      const [y, m] = periodLabel.split('-').map(Number);
      start = new Date(y, m - 1, 1);
      end   = new Date(y, m, 0, 23, 59, 59, 999);
    }
  }

  const where = {};
  if (start && end) {
    where.decisionAt = { gte: start, lte: end };
  }

  // جلب جميع قرارات الاعتماد
  const decisions = await prisma.courseClosureTracking.findMany({
    where: {
      ...where,
      status: { in: ['APPROVED', 'REJECTED', 'RETURNED'] },
      decidedById: { not: null },
    },
    select: {
      id: true,
      status: true,
      executionAt: true,   // وقت تقديم الموظف
      decisionAt:  true,   // وقت قرار المشرف
      decidedById: true,
      decider: { select: { id: true, firstName: true, lastName: true, roles: true } },
    },
  });

  // تجميع حسب المشرف
  const map = new Map();
  for (const d of decisions) {
    if (!d.decidedById || !d.decider) continue;
    if (!d.decider.roles?.includes('PROJECT_SUPERVISOR') &&
        !d.decider.roles?.includes('MANAGER')) continue;

    const key = d.decidedById;
    if (!map.has(key)) {
      map.set(key, {
        userId: key,
        name:  `${d.decider.firstName} ${d.decider.lastName}`,
        roles: d.decider.roles,
        total: 0, approved: 0, returned: 0, rejected: 0,
        totalWaitHours: 0, decidedCount: 0,
      });
    }
    const s = map.get(key);
    s.total++;
    if (d.status === 'APPROVED') s.approved++;
    if (d.status === 'RETURNED') s.returned++;
    if (d.status === 'REJECTED') s.rejected++;

    // وقت الانتظار عند المشرف
    if (d.executionAt && d.decisionAt) {
      const waitH = (new Date(d.decisionAt) - new Date(d.executionAt)) / 3600000;
      if (waitH >= 0) { s.totalWaitHours += waitH; s.decidedCount++; }
    }
  }

  const result = Array.from(map.values()).map(s => ({
    userId:       s.userId,
    name:         s.name,
    roles:        s.roles,
    totalDecisions: s.total,
    approved:     s.approved,
    returned:     s.returned,
    rejected:     s.rejected,
    approvalRate: s.total ? Math.round((s.approved / s.total) * 100) : 0,
    avgResponseHours: s.decidedCount ? Math.round(s.totalWaitHours / s.decidedCount * 10) / 10 : null,
    responsiveness: s.decidedCount
      ? s.totalWaitHours / s.decidedCount < 8  ? 'سريع جداً'
      : s.totalWaitHours / s.decidedCount < 24 ? 'مقبول'
      : s.totalWaitHours / s.decidedCount < 48 ? 'بطيء'
      : 'متأخر'
      : '-',
  })).sort((a, b) => (a.avgResponseHours ?? 999) - (b.avgResponseHours ?? 999));

  return res.status(200).json(result);
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
