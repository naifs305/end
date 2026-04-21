// =============================================================
// خدمة التحليلات (محدّثة للأدوار الثلاثة)
// -------------------------------------------------------------
// - المدير: لوحة شاملة لكل المشاريع
// - مشرف المشروع: لوحة مقيدة بمشروعه
// - الموظف: لوحة دوراته فقط
// =============================================================

const prisma = require('../db/prisma');
const permissions = require('./permissions');

/**
 * لوحة المدير/المشرف: إحصائيات عامة مع فلترة حسب الدور
 */
async function getManagerDashboard(user, activeRole, projectIdFilter) {
  // بناء شرط الدورات المرئية لهذا المستخدم
  const extraWhere = {};
  if (projectIdFilter) extraWhere.operationalProjectId = projectIdFilter;

  // المشرف يُقصر تلقائياً على مشروعه، المدير يرى الكل
  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);

  const courses = await prisma.course.findMany({
    where,
    include: {
      closureElements: { where: { status: 'PENDING_APPROVAL' } },
    },
  });

  const total = courses.length;
  const preparation = courses.filter((c) => c.status === 'PREPARATION').length;
  const execution = courses.filter((c) => c.status === 'EXECUTION').length;
  const awaiting = courses.filter((c) => c.status === 'AWAITING_CLOSURE').length;
  const closed = courses.filter((c) => c.status === 'CLOSED').length;
  const archived = courses.filter((c) => c.status === 'ARCHIVED').length;

  const pendingApprovals = courses.reduce((acc, c) => acc + c.closureElements.length, 0);

  return {
    total,
    preparation,
    execution,
    awaiting,
    closed,
    archived,
    pendingApprovals,
  };
}

/**
 * لوحة الموظف: إحصائيات دوراته الشخصية
 */
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

  const myCourses = courses.length;
  const now = new Date();

  const overdueItems = courses.flatMap((c) =>
    c.closureElements.filter(
      (el) =>
        (el.status === 'NOT_STARTED' || el.status === 'RETURNED') &&
        new Date(c.endDate) < now,
    ),
  ).length;

  const pendingMyApproval = courses.flatMap((c) =>
    c.closureElements.filter((el) => el.status === 'PENDING_APPROVAL'),
  ).length;

  return { myCourses, overdueItems, pendingMyApproval };
}

/**
 * مؤشرات أداء الموظف البسيطة (للوحة الشخصية)
 */
async function getEmployeeKPI(userId) {
  const completed = await prisma.courseClosureTracking.count({
    where: { executedById: userId, status: 'APPROVED' },
  });

  const rejected = await prisma.courseClosureTracking.count({
    where: { executedById: userId, status: 'REJECTED' },
  });

  const pending = await prisma.courseClosureTracking.count({
    where: { executedById: userId, status: 'PENDING_APPROVAL' },
  });

  const returned = await prisma.courseClosureTracking.count({
    where: { executedById: userId, status: 'RETURNED' },
  });

  return { completed, rejected, pending, returned };
}

/**
 * قائمة الاعتمادات المعلّقة (للمدير/المشرف)
 */
async function getPendingApprovalsQueue(user, activeRole) {
  // الاستعلام على الدورات اللي يحق لهذا المستخدم اعتمادها
  const coursesWhere = await permissions.buildCoursesWhere(user, activeRole);

  const items = await prisma.courseClosureTracking.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      course: coursesWhere,
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
