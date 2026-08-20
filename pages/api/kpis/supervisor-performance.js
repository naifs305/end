// GET /api/kpis/supervisor-performance?periodType=MONTHLY&periodLabel=2026-05
// للمدير فقط — يُظهر أداء كل مشرف في سرعة البت والاعتمادات
const prisma = require('../../../lib/db/prisma');
const { withManager, withMethods, ok } = require('../../../lib/server/http');

async function handler(req, res) {
  const { periodLabel, periodType = 'MONTHLY' } = req.query;

  // تحديد نطاق الفترة لجميع الأنواع (شهري / ربعي / سنوي)
  let start, end;
  if (periodLabel) {
    if (periodType === 'QUARTERLY') {
      // الصيغة: 2026-Q2
      const [yStr, qStr] = String(periodLabel).split('-Q');
      const y = Number(yStr);
      const q = Number(qStr);
      if (y && q >= 1 && q <= 4) {
        const startMonth = (q - 1) * 3;
        start = new Date(y, startMonth, 1, 0, 0, 0, 0);
        end   = new Date(y, startMonth + 3, 0, 23, 59, 59, 999);
      }
    } else if (periodType === 'YEARLY') {
      // الصيغة: 2026
      const y = Number(periodLabel);
      if (y) {
        start = new Date(y, 0, 1, 0, 0, 0, 0);
        end   = new Date(y, 11, 31, 23, 59, 59, 999);
      }
    } else {
      // MONTHLY (افتراضي): الصيغة 2026-05
      const [y, m] = String(periodLabel).split('-').map(Number);
      if (y && m) {
        start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        end   = new Date(y, m, 0, 23, 59, 59, 999);
      }
    }

    // تسمية موجودة لكن غير صالحة لنوعها → نلجأ للشهر الحالي بدل عرض كل الفترات
    if (!start || !end) {
      const nowDate = new Date();
      start = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
      end   = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
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

  // ── العناصر المعلّقة (PENDING_APPROVAL) لكل مشرف ──
  const allSupervisors = await prisma.projectSupervisor.findMany({
    select: { userId: true, operationalProjectId: true },
  });
  const supervisorProjects = new Map();
  for (const s of allSupervisors) {
    const arr = supervisorProjects.get(s.userId) || [];
    arr.push(s.operationalProjectId);
    supervisorProjects.set(s.userId, arr);
  }

  // جمع كل الموظفين حسب المشروع
  const allEmployees = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' } },
    select: { id: true, operationalProjectId: true },
  });
  const employeesByProject = new Map();
  for (const e of allEmployees) {
    const arr = employeesByProject.get(e.operationalProjectId) || [];
    arr.push(e.id);
    employeesByProject.set(e.operationalProjectId, arr);
  }

  // العناصر المعلّقة الآن
  const now = new Date();
  const pendingAll = await prisma.courseClosureTracking.findMany({
    where: { status: 'PENDING_APPROVAL' },
    select: { executedById: true, executionAt: true },
  });

  // بناء خريطة الموظف → المشاريع
  const employeeProjectMap = new Map(allEmployees.map(e => [e.id, e.operationalProjectId]));

  // حساب العناصر المعلّقة لكل مشرف
  const pendingBySupId = new Map();
  for (const p of pendingAll) {
    const projId = employeeProjectMap.get(p.executedById);
    if (!projId) continue;
    for (const [supId, projIds] of supervisorProjects) {
      if (projIds.includes(projId)) {
        const entry = pendingBySupId.get(supId) || { total: 0, urgent: 0 };
        entry.total++;
        const ageHours = p.executionAt ? (now - new Date(p.executionAt)) / 3600000 : 0;
        if (ageHours >= 72) entry.urgent++;
        pendingBySupId.set(supId, entry);
      }
    }
  }

  const result = Array.from(map.values()).map(s => {
    const avg = s.decidedCount ? s.totalWaitHours / s.decidedCount : null;
    const pending = pendingBySupId.get(s.userId) || { total: 0, urgent: 0 };
    return {
      userId:       s.userId,
      name:         s.name,
      roles:        s.roles,
      totalDecisions: s.total,
      approved:     s.approved,
      returned:     s.returned,
      rejected:     s.rejected,
      approvalRate: s.total ? Math.round((s.approved / s.total) * 100) : 0,
      avgResponseHours: avg != null ? Math.round(avg * 10) / 10 : null,
      responsiveness: avg == null ? '-'
        : avg < 8  ? 'سريع جداً'
        : avg < 24 ? 'مقبول'
        : avg < 48 ? 'بطيء'
        : 'متأخر',
      pendingTotal:  pending.total,
      pendingUrgent: pending.urgent,
    };
  }).sort((a, b) => (a.avgResponseHours ?? 999) - (b.avgResponseHours ?? 999));

  return ok(res, result);
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
