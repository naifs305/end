// =============================================================
// طبقة الوصول للبيانات لوحدة مؤشرات الأداء (Repository)
// المكان الوحيد الذي يلمس prisma ضمن هذه الوحدة.
// الاستعلامات منقولة حرفياً من lib/services/kpis.js و lib/services/analytics.js
// مع الحفاظ على خيارات الاستعلام (where/include/select/orderBy) كما هي.
// =============================================================
const prisma = require('../../db/prisma');

// ── إعدادات الأوزان النشطة ───────────────────────────────────
function findActiveSettings() {
  return prisma.employeeKpiSetting.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ── الموظفون النشطون مع مشاريعهم ─────────────────────────────
function findActiveEmployees() {
  return prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' } },
    include: { operationalProject: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

// ── جميع مشرفي المشاريع (userId + projectId) ─────────────────
function findAllProjectSupervisors() {
  return prisma.projectSupervisor.findMany({
    select: { userId: true, operationalProjectId: true },
  });
}

// ── سجلّات إسناد الدورات لفترة محددة لمجموعة موظفين ───────────
function findAssignmentRegisters(periodType, label, employeeIds) {
  return prisma.courseAssignmentRegister.findMany({
    where: { periodType, periodLabel: label, userId: { in: employeeIds } },
  });
}

// ── دورات الموظفين ضمن نطاق الفترة (مع عناصر الإقفال) ─────────
function findCoursesWithElements(employeeIds, start, end) {
  return prisma.course.findMany({
    where: {
      startDate: { lte: end },
      endDate: { gte: start },
      OR: [
        { primaryEmployeeId: { in: employeeIds } },
        { closureElements: { some: { executedById: { in: employeeIds } } } },
      ],
    },
    include: { closureElements: { include: { element: true } } },
  });
}

// دورات لا يملكها الموظف لكنه نفّذ فيها عناصر إقفال فعلياً
function findExecutedCoursesWithElements(userId, periodStart, periodEnd) {
  return prisma.course.findMany({
    where: {
      primaryEmployeeId: { not: userId },
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
      closureElements: { some: { executedById: userId } },
    },
    include: { closureElements: { include: { element: true } } },
  });
}

// ── عدد التقارير الاختيارية لكل موظف ضمن الفترة ───────────────
function groupOptionalReports(employeeIds, start, end) {
  return prisma.courseOptionalReport.groupBy({
    by: ['authorId'],
    where: { authorId: { in: employeeIds }, createdAt: { gte: start, lte: end } },
    _count: { id: true },
  }).catch(() => []);
}

// ── حفظ/تحديث لقطة أداء موظف ─────────────────────────────────
function upsertSnapshot(userId, periodType, label, snapshotData) {
  return prisma.employeeKpiSnapshot.upsert({
    where: {
      userId_periodType_periodLabel: { userId, periodType, periodLabel: label },
    },
    update: snapshotData,
    create: { userId, periodType, periodLabel: label, ...snapshotData },
    include: { user: { include: { operationalProject: true } } },
  });
}

// ── جلب اللقطات مع فلتر مستخدم ────────────────────────────────
function findSnapshots(periodType, periodLabel, userFilter) {
  return prisma.employeeKpiSnapshot.findMany({
    where: {
      ...(periodType ? { periodType } : {}),
      ...(periodLabel ? { periodLabel } : {}),
      user: userFilter,
    },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ finalScore: 'desc' }, { createdAt: 'desc' }],
  });
}

// ── سجلّات الإسناد لمجموعة مستخدمين (مع فلتر فترة اختياري) ─────
function findAssignmentsForUsers(userIds, periodType, periodLabel) {
  return prisma.courseAssignmentRegister.findMany({
    where: {
      userId: { in: userIds },
      ...(periodType ? { periodType } : {}),
      ...(periodLabel ? { periodLabel } : {}),
    },
  });
}

// ── دورات مختصرة لمجموعة مستخدمين ضمن نطاق ────────────────────
function findCoursesMinimal(userIds, globalStart, globalEnd) {
  return prisma.course.findMany({
    where: {
      primaryEmployeeId: { in: userIds },
      startDate: { lte: globalEnd },
      endDate: { gte: globalStart },
    },
    select: { id: true, primaryEmployeeId: true, startDate: true, endDate: true },
  });
}

// ── المشروع التشغيلي لمستخدم (للتحقق من نطاق المشرف) ──────────
function findUserProject(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { operationalProjectId: true },
  });
}

// ── لقطة موظف واحد (تفاصيل) ───────────────────────────────────
function findSnapshotForDetails(userId, periodType, periodLabel) {
  return prisma.employeeKpiSnapshot.findUnique({
    where: { userId_periodType_periodLabel: { userId, periodType, periodLabel } },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
  });
}

// ── سجل إسناد واحد (مفتاح مركّب) ──────────────────────────────
function findAssignmentUnique(userId, periodType, periodLabel) {
  return prisma.courseAssignmentRegister.findUnique({
    where: { userId_periodType_periodLabel: { userId, periodType, periodLabel } },
  });
}

// ── عدد دورات موظف ضمن نطاق ───────────────────────────────────
function countCoursesInRange(userId, periodStart, periodEnd) {
  return prisma.course.count({
    where: {
      primaryEmployeeId: userId,
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
  });
}

// ── دورات موظف ضمن نطاق (مع عناصر الإقفال) ────────────────────
function findEmployeeCoursesWithElements(userId, periodStart, periodEnd) {
  return prisma.course.findMany({
    where: {
      primaryEmployeeId: userId,
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
    include: { closureElements: { include: { element: true } } },
  });
}

// ── لقطات أداء موظف عبر فترات (Trend) ─────────────────────────
function findTrendSnapshots(userId, periodType, safeCount) {
  return prisma.employeeKpiSnapshot.findMany({
    where: { userId, ...(periodType ? { periodType } : {}) },
    orderBy: { periodStart: 'desc' },
    take: safeCount,
    select: {
      id: true,
      periodType: true,
      periodLabel: true,
      periodStart: true,
      periodEnd: true,
      finalScore: true,
      productivityScore: true,
      qualityScore: true,
      speedScore: true,
      disciplineScore: true,
      performanceLevel: true,
      closureCompletionRate: true,
      firstPassApprovalRate: true,
      returnRate: true,
      overdueElementsRate: true,
    },
  });
}

// ── ملخص أداء مشروع ───────────────────────────────────────────
function findProjectSnapshots(operationalProjectId, periodType, periodLabel) {
  return prisma.employeeKpiSnapshot.findMany({
    where: {
      periodType,
      periodLabel,
      user: { isActive: true, operationalProjectId },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { finalScore: 'desc' },
  });
}

// ── لقطة واحدة بالمعرّف ───────────────────────────────────────
function findSnapshotById(snapshotId) {
  return prisma.employeeKpiSnapshot.findUnique({ where: { id: snapshotId } });
}

// ── إنشاء ملاحظة مدير على لقطة ────────────────────────────────
function createNote(snapshotId, userId, managerId, note) {
  return prisma.employeeKpiNote.create({
    data: { snapshotId, userId, managerId, note },
    include: { manager: true },
  });
}

// ── دورات مختصرة لسجل الإسناد ─────────────────────────────────
function findCoursesForRegister(userIds, start, end) {
  return prisma.course.findMany({
    where: {
      primaryEmployeeId: { in: userIds },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, primaryEmployeeId: true },
  });
}

// ── موظف نشط واحد ─────────────────────────────────────────────
function findActiveUser(userId) {
  return prisma.user.findFirst({ where: { id: userId, isActive: true } });
}

// ── حفظ/تحديث سجل إسناد ───────────────────────────────────────
function upsertAssignment(userId, periodType, label, start, end, assignedCoursesCount, notes) {
  return prisma.courseAssignmentRegister.upsert({
    where: { userId_periodType_periodLabel: { userId, periodType, periodLabel: label } },
    update: { assignedCoursesCount, notes, periodStart: start, periodEnd: end },
    create: { userId, periodType, periodLabel: label, periodStart: start, periodEnd: end, assignedCoursesCount, notes },
  });
}

// ── لوحة ترتيب المشاريع (لقطات شهرية) ─────────────────────────
function findLeaderboardSnapshots(periodLabel) {
  return prisma.employeeKpiSnapshot.findMany({
    where: { periodType: 'MONTHLY', periodLabel, finalScore: { gte: 0 } },
    include: { user: { include: { operationalProject: true } } },
  });
}

// =============================================================
// استعلامات analytics
// =============================================================

// ── المستخدمون غير النشطين (المعرّفات فقط) ────────────────────
function findInactiveUserIds() {
  return prisma.user.findMany({
    where: { isActive: false },
    select: { id: true },
  });
}

function countCourses(where) {
  return prisma.course.count({ where });
}

function countClosureTracking(where) {
  return prisma.courseClosureTracking.count({ where });
}

function findUsersByWhere(where, select) {
  return prisma.user.findMany({ where, select });
}

// ── لقطات لوحة المدير ─────────────────────────────────────────
function findDashboardSnapshots(label, userWhere) {
  return prisma.employeeKpiSnapshot.findMany({
    where: { periodType: 'MONTHLY', periodLabel: label, user: userWhere, finalScore: { gte: 0 } },
    select: {
      userId: true,
      finalScore: true,
      performanceLevel: true,
      user: { select: { firstName: true, lastName: true, operationalProject: { select: { name: true } } } },
    },
    orderBy: [{ finalScore: 'desc' }],
    take: 10,
  });
}

// ── أحدث الدورات للوحة المدير ─────────────────────────────────
function findLatestCoursesForManager(courseWhere) {
  return prisma.course.findMany({
    where: courseWhere,
    select: {
      id: true, name: true, status: true, startDate: true, endDate: true,
      primaryEmployee: { select: { firstName: true, lastName: true } },
      closureElements: { select: { status: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 8,
  });
}

// ── لقطة موظف للوحة الموظف ────────────────────────────────────
function findEmployeeDashboardSnapshot(userId, label) {
  return prisma.employeeKpiSnapshot.findUnique({
    where: {
      userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel: label },
    },
    select: { speedScore: true, disciplineScore: true, finalScore: true, qualityScore: true, productivityScore: true },
  });
}

// ── أحدث الدورات للوحة الموظف ─────────────────────────────────
function findLatestCoursesForEmployee(courseWhere) {
  return prisma.course.findMany({
    where: courseWhere,
    select: { id: true, name: true, status: true, startDate: true, endDate: true },
    orderBy: [{ endDate: 'desc' }],
    take: 8,
  });
}

// ── لقطة KPI للموظف (كاملة) ───────────────────────────────────
function findEmployeeKPISnapshot(userId, label) {
  return prisma.employeeKpiSnapshot.findUnique({
    where: { userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel: label } },
  });
}

// ── طابور الاعتمادات المعلّقة ─────────────────────────────────
function findPendingApprovals(courseWhere, excludedUserIds) {
  return prisma.courseClosureTracking.findMany({
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
}

module.exports = {
  // kpi engine
  findActiveSettings,
  findActiveEmployees,
  findAllProjectSupervisors,
  findAssignmentRegisters,
  findCoursesWithElements,
  groupOptionalReports,
  upsertSnapshot,
  findSnapshots,
  findAssignmentsForUsers,
  findCoursesMinimal,
  findUserProject,
  findSnapshotForDetails,
  findAssignmentUnique,
  countCoursesInRange,
  findEmployeeCoursesWithElements,
  findExecutedCoursesWithElements,
  findTrendSnapshots,
  findProjectSnapshots,
  findSnapshotById,
  createNote,
  findCoursesForRegister,
  findActiveUser,
  upsertAssignment,
  findLeaderboardSnapshots,
  // analytics
  findInactiveUserIds,
  countCourses,
  countClosureTracking,
  findUsersByWhere,
  findDashboardSnapshots,
  findLatestCoursesForManager,
  findEmployeeDashboardSnapshot,
  findLatestCoursesForEmployee,
  findEmployeeKPISnapshot,
  findPendingApprovals,
};
