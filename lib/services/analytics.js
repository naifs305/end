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
    prisma.courseClosureTracking.count({ where: { status: 'PENDING_APPROVAL', course: courseWhere } }),
    prisma.course.count({ where: { ...courseWhere, endDate: { lt: new Date() }, status: { notIn: ['CLOSED', 'ARCHIVED'] } } }),
    prisma.user.findMany({ where: userWhere, select: { id: true, roles: true } }),
    prisma.employeeKpiSnapshot.findMany({
      where: { periodType: 'MONTHLY', periodLabel: label, user: userWhere },
      select: {
        userId: true,
        finalScore: true,
        performanceLevel: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ finalScore: 'desc' }],
      take: 10,
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: [{ endDate: 'desc' }],
      take: 8,
    }),
  ]);

  const totalUsers = activeUsers.length;
  const employeesCount = activeUsers.filter((u) => u.roles.includes('EMPLOYEE')).length;
  const supervisorsCount = activeUsers.filter((u) => u.roles.includes('PROJECT_SUPERVISOR')).length;
  const managersCount = activeUsers.filter((u) => u.roles.includes('MANAGER')).length;
  const qualityViewersCount = activeUsers.filter((u) => u.roles.includes('QUALITY_VIEWER')).length;

  const topPerformer = latestSnapshots[0] || null;
  const lowPerformer = latestSnapshots.length ? latestSnapshots[latestSnapshots.length - 1] : null;
  const averageScore = latestSnapshots.length
    ? latestSnapshots.reduce((sum, item) => sum + Number(item.finalScore || 0), 0) / latestSnapshots.length
    : 0;

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
    lowPerformer,
    averageScore,
    activePeriodLabel: label,
    latestCourses,
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

module.exports = {
  getManagerDashboard,
  getEmployeeDashboard,
  getEmployeeKPI,
};
