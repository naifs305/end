const prisma = require('../db/prisma');
const permissions = require('./permissions');

function getCurrentMonthlyPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const label = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return { start, end, label };
}

async function getVisibleCourseWhere(user, activeRole, extraWhere = {}) {
  return permissions.buildCoursesWhere(user, activeRole, extraWhere);
}

async function getManagerDashboard(user, activeRole, projectIdFilter) {
  const extraWhere = {};
  if (projectIdFilter) extraWhere.operationalProjectId = projectIdFilter;

  const courseWhere = await getVisibleCourseWhere(user, activeRole, extraWhere);
  const { label } = getCurrentMonthlyPeriod();

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
      },
    }),
    prisma.course.count({
      where: {
        ...courseWhere,
        endDate: { lt: new Date() },
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
      },
    }),
    prisma.user.findMany({
      where:
        activeRole === 'MANAGER'
          ? { isActive: true }
          : {
              isActive: true,
              operationalProjectId: projectIdFilter || user.operationalProjectId,
            },
      select: {
        id: true,
        roles: true,
      },
    }),
    prisma.employeeKpiSnapshot.findMany({
      where: {
        periodType: 'MONTHLY',
        periodLabel: label,
        user:
          activeRole === 'MANAGER'
            ? { isActive: true }
            : {
                isActive: true,
                operationalProjectId: projectIdFilter || user.operationalProjectId,
              },
      },
      select: {
        userId: true,
        finalScore: true,
        performanceLevel: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ finalScore: 'desc' }],
      take: 10,
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
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

async function getEmployeeDashboard(user) {
  const courseWhere = {
    OR: [{ primaryEmployeeId: user.id }, { supportingTeam: { some: { userId: user.id } } }],
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
    prisma.course.count({
      where: {
        ...courseWhere,
        closureElements: { some: { status: 'PENDING_APPROVAL' } },
      },
    }),
    prisma.employeeKpiSnapshot.findUnique({
      where: {
        userId_periodType_periodLabel: {
          userId: user.id,
          periodType: 'MONTHLY',
          periodLabel: label,
        },
      },
      select: {
        speedScore: true,
        disciplineScore: true,
        finalScore: true,
        qualityScore: true,
        productivityScore: true,
      },
    }),
    prisma.course.findMany({
      where: courseWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
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
    latestCourses,
  };
}

async function getEmployeeKPI(userId) {
  const { label } = getCurrentMonthlyPeriod();
  return prisma.employeeKpiSnapshot.findUnique({
    where: {
      userId_periodType_periodLabel: {
        userId,
        periodType: 'MONTHLY',
        periodLabel: label,
      },
    },
  });
}

async function getPendingApprovalsQueue(user, activeRole) {
  const courseWhere = await permissions.buildCoursesWhere(user, activeRole);

  const items = await prisma.courseClosureTracking.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      course: courseWhere,
    },
    include: {
      element: true,
      course: {
        include: {
          operationalProject: true,
          primaryEmployee: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { executionAt: 'asc' },
    take: 20,
  });

  return items.map((item) => ({
    id: item.id,
    elementName: item.element.name,
    elementKey: item.element.key,
    courseId: item.courseId,
    courseName: item.course.name,
    courseCode: item.course.code,
    projectName: item.course.operationalProject?.name,
    employeeName: `${item.course.primaryEmployee.firstName} ${item.course.primaryEmployee.lastName}`,
    submittedAt: item.executionAt,
  }));
}

module.exports = {
  getManagerDashboard,
  getEmployeeDashboard,
  getEmployeeKPI,
  getPendingApprovalsQueue,
};
