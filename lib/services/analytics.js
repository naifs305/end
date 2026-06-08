const prisma = require('../db/prisma');
const permissions = require('./permissions');

function getCurrentMonthlyPeriod() {
  const now = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { label };
}

async function getVisibleCourseWhere(user, activeRole, extraWhere = {}) {
  return permissions.buildCoursesWhere(user, activeRole, extraWhere);
}

async function getManagerDashboard(user, activeRole, projectIdFilter) {
  const extraWhere = {};
  if (projectIdFilter) extraWhere.operationalProjectId = projectIdFilter;

  const courseWhere = await getVisibleCourseWhere(user, activeRole, extraWhere);
  const { label } = getCurrentMonthlyPeriod();
  const inactiveUsers = await prisma.user.findMany({
    where: { isActive: false },
    select: { id: true },
  });
  const excludedUserIds = inactiveUsers.map((item) => item.id);

  const userWhere = activeRole === 'MANAGER'
    ? { isActive: true }
    : { isActive: true, operationalProjectId: projectIdFilter || user.operationalProjectId };

  const [
    totalCourses,
    preparationCourses,
    executionCourses,
    awaitingClosureCourses,
    closedCourses,
    archivedCourses,
    pendingApprovals,
    endedNotClosedCourses,
    activeUsers,
    latestSnapshots,
    latestCourses,
  ] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.course.count({ where: { ...courseWhere, status: 'PREPARATION' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'EXECUTION' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'AWAITING_CLOSURE' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'CLOSED' } }),
    prisma.course.count({ where: { ...courseWhere, status: 'ARCHIVED' } }),
    prisma.courseClosureTracking.count({
      where: {
        status: 'PENDING_APPROVAL',
        course: courseWhere,
        ...(excludedUserIds.length ? { NOT: { executedById: { in: excludedUserIds } } } : {}),
      },
    }),
    prisma.course.count({ where: { ...courseWhere, endDate: { lt: new Date() }, status: { notIn: ['CLOSED', 'ARCHIVED'] } } }),
    prisma.user.findMany({ where: userWhere, select: { id: true, roles: true } }),
    prisma.employeeKpiSnapshot.findMany({
      where: { periodType: 'MONTHLY', periodLabel: label, user: userWhere },
      select: {
        userId: true,
        finalScore: true,
        performanceLevel: true,
        user: { select: { firstName: true, lastName: true, operationalProject: { select: { name: true } } } },
      },
      where: { finalScore: { gt: 0 } },
      orderBy: [{ finalScore: 'desc' }],
      take: 10,
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: {
        id: true, name: true, status: true, startDate: true, endDate: true,
        primaryEmployee: { select: { firstName: true, lastName: true } },
        closureElements: { select: { status: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 8,
    }),
  ]);

  const totalUsers = activeUsers.length;
  const employeesCount = activeUsers.filter((u) => u.roles.includes('EMPLOYEE')).length;
  const supervisorsCount = activeUsers.filter((u) => u.roles.includes('PROJECT_SUPERVISOR')).length;
  const managersCount = activeUsers.filter((u) => u.roles.includes('MANAGER')).length;
  const qualityViewersCount = activeUsers.filter((u) => u.roles.includes('QUALITY_VIEWER')).length;

  const topPerformer = latestSnapshots[0] || null;
  const averageScore = latestSnapshots.length
    ? latestSnapshots.reduce((sum, item) => sum + Number(item.finalScore || 0), 0) / latestSnapshots.length
    : 0;

  // لوحة ترتيب المشاريع — تجميع من نفس الـ snapshots
  const projectMap = {};
  for (const s of latestSnapshots) {
    const proj = s.user?.operationalProject;
    if (!proj) continue;
    if (!projectMap[proj.id]) projectMap[proj.id] = { id: proj.id, name: proj.name, scores: [], top: null };
    projectMap[proj.id].scores.push(Number(s.finalScore || 0));
    if (!projectMap[proj.id].top || s.finalScore > projectMap[proj.id].top.score) {
      projectMap[proj.id].top = { name: `${s.user.firstName} ${s.user.lastName}`, score: Number(s.finalScore) };
    }
  }
  const projectLeaderboard = Object.values(projectMap)
    .map(p => ({
      projectId:   p.id,
      projectName: p.name,
      employeesCount: p.scores.length,
      avgScore: p.scores.length ? Number((p.scores.reduce((a,b)=>a+b,0)/p.scores.length).toFixed(1)) : 0,
      topEmployee: p.top,
    }))
    .sort((a,b) => b.avgScore - a.avgScore);

  return {
    totalCourses,
    preparationCourses,
    executionCourses,
    awaitingClosureCourses,
    closedCourses,
    archivedCourses,
    pendingApprovals,
    endedNotClosedCourses,
    totalUsers,
    employeesCount,
    supervisorsCount,
    managersCount,
    qualityViewersCount,
    kpiUsersCount: latestSnapshots.length,
    topPerformer,
    averageScore,
    activePeriodLabel: label,
    latestCourses,
    projectLeaderboard,
  };
}

async function getEmployeeDashboard(userOrId) {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId?.id;
  if (!userId) {
    return {
      totalCourses: 0,
      openCourses: 0,
      closedCourses: 0,
      pendingApprovalCourses: 0,
      latestCourses: [],
      kpi: null,
      activePeriodLabel: getCurrentMonthlyPeriod().label,
    };
  }

  const courseWhere = {
    OR: [
      { primaryEmployeeId: userId },
      { supportingTeam: { some: { userId } } },
    ],
  };

  const { label } = getCurrentMonthlyPeriod();

  const [
    totalCourses,
    openCourses,
    closedCourses,
    pendingApprovalCourses,
    mySnapshot,
    latestCourses,
  ] = await Promise.all([
    prisma.course.count({ where: courseWhere }),
    prisma.course.count({ where: { ...courseWhere, status: { notIn: ['CLOSED', 'ARCHIVED'] } } }),
    prisma.course.count({ where: { ...courseWhere, status: { in: ['CLOSED', 'ARCHIVED'] } } }),
    prisma.course.count({ where: { ...courseWhere, closureElements: { some: { status: 'PENDING_APPROVAL' } } } }),
    prisma.employeeKpiSnapshot.findUnique({
      where: {
        userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel: label },
      },
      select: { speedScore: true, disciplineScore: true, finalScore: true, qualityScore: true, productivityScore: true },
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: [{ endDate: 'desc' }],
      take: 8,
    }),
  ]);

  return {
    totalCourses,
    openCourses,
    closedCourses,
    pendingApprovalCourses,
    latestCourses,
    kpi: mySnapshot,
    activePeriodLabel: label,
  };
}

async function getEmployeeKPI(userId) {
  const { label } = getCurrentMonthlyPeriod();
  return prisma.employeeKpiSnapshot.findUnique({
    where: { userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel: label } },
  });
}


async function getPendingApprovalsQueue(user, activeRole) {
  const courseWhere = await getVisibleCourseWhere(user, activeRole);
  const inactiveUsers = await prisma.user.findMany({
    where: { isActive: false },
    select: { id: true },
  });
  const excludedUserIds = inactiveUsers.map((item) => item.id);

  const items = await prisma.courseClosureTracking.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      course: courseWhere,
      ...(excludedUserIds.length ? { NOT: { executedById: { in: excludedUserIds } } } : {}),
    },
    include: {
      course: {
        select: {
          id: true, name: true, code: true,
          operationalProject: { select: { id: true, name: true } },
        },
      },
      element:  { select: { key: true, name: true } },
      executor: { select: { id: true, firstName: true, lastName: true, email: true } },
      decider:  { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { executionAt: 'asc' },
  });

  // ─ تحويل لقائمة مفصّلة ─
  const flatItems = items.map((item) => {
    const waitMs      = item.executionAt ? Date.now() - new Date(item.executionAt).getTime() : 0;
    const waitHours   = Math.floor(waitMs / 3600000);
    const empId       = item.executor?.id || 'unknown';
    const empName     = `${item.executor?.firstName || ''} ${item.executor?.lastName || ''}`.trim() || item.executor?.email || '-';
    const isUrgent    = waitHours >= 24;
    const isCritical  = waitHours >= 48;

    return {
      id:           item.id,
      courseId:     item.courseId,
      courseName:   item.course?.name  || '-',
      courseCode:   item.course?.code  || '-',
      projectName:  item.course?.operationalProject?.name || '-',
      elementKey:   item.element?.key  || '-',
      elementName:  item.element?.name || '-',
      employeeId:   empId,
      employeeName: empName,
      submittedAt:  item.executionAt,
      waitHours,
      isUrgent,
      isCritical,
      delayReason:  item.delayReason   || null,
      notes:        item.notes         || null,
      // آخر قرار (إعادة سابقة)
      lastDecidedBy: item.decider
        ? `${item.decider.firstName} ${item.decider.lastName}`
        : null,
      lastDecisionAt: item.decisionAt  || null,
      wasReturned:  !!item.decisionAt && !!item.notes,
      formData:     item.formData      || null,
    };
  });

  // ─ تجميع حسب الموظف ─
  const byEmployee = {};
  for (const el of flatItems) {
    if (!byEmployee[el.employeeId]) {
      byEmployee[el.employeeId] = {
        employeeId:   el.employeeId,
        employeeName: el.employeeName,
        projectName:  el.projectName,
        items:        [],
        urgentCount:  0,
        criticalCount: 0,
      };
    }
    byEmployee[el.employeeId].items.push(el);
    if (el.isCritical) byEmployee[el.employeeId].criticalCount++;
    else if (el.isUrgent) byEmployee[el.employeeId].urgentCount++;
  }

  const grouped = Object.values(byEmployee).sort((a, b) => {
    // الأكثر إلحاحاً أولاً
    if (b.criticalCount !== a.criticalCount) return b.criticalCount - a.criticalCount;
    if (b.urgentCount   !== a.urgentCount)   return b.urgentCount   - a.urgentCount;
    return b.items.length - a.items.length;
  });

  return { grouped, total: flatItems.length };
}

module.exports = {
  getManagerDashboard,
  getEmployeeDashboard,
  getEmployeeKPI,
  getPendingApprovalsQueue,
};
