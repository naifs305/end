// GET /api/analytics/kpi-multi-period?months=2026-06,2026-07,2026-08
// يعيد درجات مجمّعة لكل الموظفين عبر الشهور المحددة
const prisma  = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

const PERF_LEVELS = [
  { key: 'OUTSTANDING',       min: 90 },
  { key: 'VERY_GOOD',         min: 80 },
  { key: 'GOOD',              min: 70 },
  { key: 'NEEDS_IMPROVEMENT', min: 50 },
  { key: 'WEAK',              min: 0  },
];
function levelOf(score) {
  for (const l of PERF_LEVELS) if (score >= l.min) return l.key;
  return 'WEAK';
}

async function handler(req, res) {
  const { user, activeRole } = req;

  // صلاحية: مدير أو مشرف فقط
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole)) {
    return res.status(403).json({ message: 'للمدير والمشرف فقط' });
  }

  const monthsParam = req.query.months || '';
  const months = monthsParam.split(',').map(m => m.trim()).filter(m => /^\d{4}-\d{2}$/.test(m));
  if (!months.length) return res.status(400).json({ message: 'حدد شهراً واحداً على الأقل' });

  // فلتر المستخدمين حسب الدور
  let userFilter = { isActive: true };
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervised = await prisma.operationalProject.findMany({
      where: { supervisors: { some: { id: user.id } } },
      select: { id: true },
    });
    const pids = supervised.map(p => p.id);
    userFilter = { isActive: true, operationalProjectId: { in: pids } };
  }

  // جلب جميع اللقطات للشهور المحددة
  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: {
      periodType: 'MONTHLY',
      periodLabel: { in: months },
      user: userFilter,
    },
    include: {
      user: { include: { operationalProject: true } },
    },
    orderBy: { periodLabel: 'asc' },
  });

  // تجميع اللقطات لكل موظف
  const byUser = new Map();
  for (const s of snapshots) {
    const uid = s.userId;
    if (!byUser.has(uid)) {
      byUser.set(uid, { user: s.user, months: [] });
    }
    byUser.get(uid).months.push(s);
  }

  const SCORE_KEYS = [
    'finalScore', 'productivityScore', 'timelinessScore',
    'qualityScore', 'criticalScore', 'speedScore', 'disciplineScore',
    'closureCompletionRate', 'overdueElementsCount', 'actualCoursesCount',
  ];

  const results = [];
  for (const [uid, { user: u, months: mSnaps }] of byUser) {
    // فقط الشهور حيث isSubjectToEvaluation = true
    const active = mSnaps.filter(s => s.isSubjectToEvaluation);
    const isSubjectToEvaluation = active.length > 0;

    const agg = {};
    for (const key of SCORE_KEYS) {
      if (['overdueElementsCount', 'actualCoursesCount'].includes(key)) {
        // جمع (لا متوسط) للأرقام التراكمية
        agg[key] = active.reduce((sum, s) => sum + (Number(s[key]) || 0), 0);
      } else {
        // متوسط الدرجات
        agg[key] = active.length
          ? active.reduce((sum, s) => sum + (Number(s[key]) || 0), 0) / active.length
          : 0;
      }
    }

    const finalScore = agg.finalScore;
    const performanceLevel = isSubjectToEvaluation ? levelOf(finalScore) : null;

    results.push({
      userId: uid,
      user: u,
      periodType: 'CUSTOM',
      periodLabel: months.join(','),
      isSubjectToEvaluation,
      finalScore:          isSubjectToEvaluation ? finalScore : null,
      finalScoreDisplay:   isSubjectToEvaluation ? finalScore : null,
      performanceLevel,
      productivityScore:   agg.productivityScore,
      timelinessScore:     agg.timelinessScore,
      qualityScore:        agg.qualityScore,
      criticalScore:       agg.criticalScore,
      speedScore:          agg.speedScore,
      disciplineScore:     agg.disciplineScore,
      closureCompletionRate: agg.closureCompletionRate,
      overdueElementsCount:  agg.overdueElementsCount,
      actualCoursesCount:    agg.actualCoursesCount,
      // تفاصيل إضافية
      monthsIncluded:  active.length,
      monthsTotal:     mSnaps.length,
      monthDetail:     mSnaps.map(s => ({
        periodLabel: s.periodLabel,
        finalScore:  s.isSubjectToEvaluation ? Number(s.finalScore) : null,
        isSubjectToEvaluation: s.isSubjectToEvaluation,
        performanceLevel: s.performanceLevel,
      })),
    });
  }

  // أضف الموظفين الذين لا توجد لهم لقطات أصلاً في هذه الشهور
  const allUsers = await prisma.user.findMany({
    where: { ...userFilter },
    select: { id: true, firstName: true, lastName: true, operationalProject: { select: { id: true, name: true } } },
  });
  const existingIds = new Set(byUser.keys());
  for (const u of allUsers) {
    if (!existingIds.has(u.id)) {
      results.push({
        userId: u.id,
        user: u,
        periodType: 'CUSTOM',
        periodLabel: months.join(','),
        isSubjectToEvaluation: false,
        finalScore: null,
        finalScoreDisplay: null,
        performanceLevel: null,
        productivityScore: 0,
        timelinessScore: 0,
        qualityScore: 0,
        criticalScore: 0,
        speedScore: 0,
        disciplineScore: 0,
        closureCompletionRate: 0,
        overdueElementsCount: 0,
        actualCoursesCount: 0,
        monthsIncluded: 0,
        monthsTotal: 0,
        monthDetail: [],
      });
    }
  }

  results.sort((a, b) => {
    if (a.isSubjectToEvaluation !== b.isSubjectToEvaluation)
      return a.isSubjectToEvaluation ? -1 : 1;
    return (b.finalScore ?? -1) - (a.finalScore ?? -1);
  });

  return res.status(200).json(results);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
