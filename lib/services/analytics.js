const prisma = require('../db/prisma');
const permissions = require('./permissions');

async function getManagerDashboard(user, activeRole, projectIdFilter) {
  const extraWhere = {};
  if (projectIdFilter) extraWhere.operationalProjectId = projectIdFilter;

  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);
  const courses = await prisma.course.findMany({
    where,
    include: {
      closureElements: true,
    },
  });

  const totalCourses = courses.length;
  const preparationCourses = courses.filter((course) => course.status === 'PREPARATION').length;
  const executionCourses = courses.filter((course) => course.status === 'EXECUTION').length;
  const awaitingClosureCourses = courses.filter((course) => course.status === 'AWAITING_CLOSURE').length;
  const closedCourses = courses.filter((course) => course.status === 'CLOSED').length;
  const archivedCourses = courses.filter((course) => course.status === 'ARCHIVED').length;
  const pendingElements = courses.reduce(
    (sum, course) => sum + course.closureElements.filter((item) => item.status === 'PENDING_APPROVAL').length,
    0,
  );

  return {
    totalCourses,
    preparationCourses,
    executionCourses,
    awaitingClosureCourses,
    closedCourses,
    archivedCourses,
    pendingElements,
  };
}

async function getEmployeeDashboard(userId) {
  const courses = await prisma.course.findMany({
    where: {
      OR: [
        { primaryEmployeeId: userId },
        { supportingTeam: { some: { userId } } },
      ],
    },
    include: { closureElements: true },
  });

  const now = new Date();

  return {
    myCourses: courses.length,
    openCourses: courses.filter((course) => !['CLOSED', 'ARCHIVED'].includes(course.status)).length,
    closedCourses: courses.filter((course) => ['CLOSED', 'ARCHIVED'].includes(course.status)).length,
    overdueItems: courses.flatMap((course) =>
      course.closureElements.filter((item) =>
        ['NOT_STARTED', 'RETURNED'].includes(item.status) && new Date(course.endDate) < now,
      )).length,
    pendingMyApproval: courses.flatMap((course) =>
      course.closureElements.filter((item) => item.status === 'PENDING_APPROVAL')).length,
    courses,
  };
}

async function getEmployeeKPI(userId) {
  const [completed, rejected, pending, returned] = await Promise.all([
    prisma.courseClosureTracking.count({ where: { executedById: userId, status: 'APPROVED' } }),
    prisma.courseClosureTracking.count({ where: { executedById: userId, status: 'REJECTED' } }),
    prisma.courseClosureTracking.count({ where: { executedById: userId, status: 'PENDING_APPROVAL' } }),
    prisma.courseClosureTracking.count({ where: { executedById: userId, status: 'RETURNED' } }),
  ]);

  return { completed, rejected, pending, returned };
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
  });

  return items.map((item) => ({
    id: item.id,
    elementName: item.element.name,
    elementKey: item.element.key,
    courseId: item.courseId,
    courseName: item.course.name,
    courseCode: item.course.code,
    projectName: item.course.operationalProject?.name || '-',
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
