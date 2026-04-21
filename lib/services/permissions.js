// =============================================================
// خدمة الصلاحيات المركزية
// -------------------------------------------------------------
// منطق التحقق من الصلاحيات لجميع العمليات في النظام.
// كل المسارات تستدعي هذه الخدمة ولا تُنفّذ فحوصاً خاصة بها.
// =============================================================

const prisma = require('../db/prisma');

// ======================================================================
// المساعدات الأساسية
// ======================================================================

/**
 * يرجع قائمة معرّفات المشاريع التي يشرف عليها المستخدم (مرتبط بدور PROJECT_SUPERVISOR)
 */
async function getSupervisedProjectIds(userId) {
  const rows = await prisma.projectSupervisor.findMany({
    where: { userId },
    select: { operationalProjectId: true },
  });
  return rows.map((r) => r.operationalProjectId);
}

/**
 * يتحقق إذا كان المستخدم يشرف على مشروع محدد
 */
async function isSupervisorOf(userId, operationalProjectId) {
  const exists = await prisma.projectSupervisor.findFirst({
    where: { userId, operationalProjectId },
  });
  return !!exists;
}

/**
 * يحدد الدور النشط الفعلي من رأس الطلب
 * إذا لم يُحدّد في الرأس، يُختار حسب الأولوية: MANAGER > PROJECT_SUPERVISOR > EMPLOYEE
 */
function resolveActiveRole(user, headerRole) {
  const userRoles = user.roles || [];

  if (headerRole && userRoles.includes(headerRole)) return headerRole;

  if (userRoles.includes('MANAGER')) return 'MANAGER';
  if (userRoles.includes('PROJECT_SUPERVISOR')) return 'PROJECT_SUPERVISOR';
  if (userRoles.includes('EMPLOYEE')) return 'EMPLOYEE';

  return userRoles[0] || 'EMPLOYEE';
}

// ======================================================================
// قرارات الصلاحيات على الدورات
// ======================================================================

/**
 * هل يحق للمستخدم رؤية هذه الدورة؟
 * - المدير: جميع الدورات
 * - مشرف المشروع: دورات مشروعه + دوراته الشخصية
 * - الموظف: دوراته فقط (رئيسي أو داعم)
 */
async function canViewCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisesProject = await isSupervisorOf(user.id, course.operationalProjectId);
    if (supervisesProject) return true;
    // أيضاً يقدر يشوف دوراته الشخصية
  }

  // EMPLOYEE أو مشرف يشاهد دوراته فقط
  if (course.primaryEmployeeId === user.id) return true;

  const supporting = await prisma.courseSupport.findFirst({
    where: { courseId: course.id, userId: user.id },
  });
  return !!supporting;
}

/**
 * هل يحق للمستخدم تعديل الدورة؟
 * - المدير: كل الدورات بلا قيود
 * - مشرف المشروع: دورات مشروعه بلا قيود
 * - الموظف (منشئ الدورة): فقط في مرحلة الإعداد
 */
async function canEditCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return { allowed: true };

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const isSuper = await isSupervisorOf(user.id, course.operationalProjectId);
    if (isSuper) return { allowed: true };
  }

  // موظف: فقط منشئ الدورة في مرحلة الإعداد
  if (course.primaryEmployeeId === user.id) {
    if (course.status === 'PREPARATION') return { allowed: true };
    return { allowed: false, reason: 'لا يمكن تعديل الدورة بعد انتقالها من مرحلة الإعداد' };
  }

  return { allowed: false, reason: 'لا تملك صلاحية تعديل هذه الدورة' };
}

/**
 * هل يحق للمستخدم حذف الدورة؟
 * - المدير ومشرف المشروع: بلا قيود (للمشرف ضمن مشروعه)
 * - الموظف (منشئ الدورة): فقط في مرحلة الإعداد
 */
async function canDeleteCourse(user, activeRole, course) {
  return canEditCourse(user, activeRole, course);
}

/**
 * هل يحق للمستخدم إنشاء دورة في مشروع محدد؟
 * - المدير: بلا قيود
 * - مشرف المشروع: في مشروعه فقط
 * - الموظف: في مشروعه الأساسي فقط
 */
async function canCreateCourseInProject(user, activeRole, operationalProjectId) {
  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, operationalProjectId);
  }

  // الموظف: يقدر ينشئ فقط في مشروعه الأساسي
  return user.operationalProjectId === operationalProjectId;
}

/**
 * هل يحق للمستخدم أرشفة الدورة؟ (المدير + مشرف المشروع)
 */
async function canArchiveCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, course.operationalProjectId);
  }
  return false;
}

/**
 * هل يحق للمستخدم إعادة إسناد الدورة؟
 */
async function canReassignCourse(user, activeRole, course) {
  return canArchiveCourse(user, activeRole, course);
}

// ======================================================================
// قرارات الصلاحيات على عناصر الإقفال
// ======================================================================

/**
 * هل يحق للمستخدم تقديم عنصر إقفال؟
 * - منشئ الدورة أو أحد الفريق الداعم (بأي دور يحمله)
 */
async function canSubmitElement(user, course) {
  if (course.primaryEmployeeId === user.id) return true;

  const supporting = await prisma.courseSupport.findFirst({
    where: { courseId: course.id, userId: user.id },
  });
  return !!supporting;
}

/**
 * هل يحق للمستخدم اعتماد/رفض/إعادة عنصر إقفال؟
 * - المدير: بلا قيود
 * - مشرف المشروع: في مشروعه (حتى لو كانت الدورة مسندة له شخصياً — الاعتماد الذاتي مسموح)
 */
async function canDecideElement(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, course.operationalProjectId);
  }
  return false;
}

// ======================================================================
// قرارات الصلاحيات على المستخدمين
// ======================================================================

/**
 * هل يحق له إدارة مستخدم (تعديل بيانات، إعادة تعيين كلمة مرور)؟
 * - المدير: جميع المستخدمين
 * - مشرف المشروع: موظفي مشروعه فقط
 */
async function canManageUser(user, activeRole, targetUser) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, targetUser.operationalProjectId);
  }
  return false;
}

/**
 * هل يحق له تقييم أداء الموظفين (KPI)؟
 * - المدير فقط (صراحة)
 */
function canEvaluatePerformance(activeRole) {
  return activeRole === 'MANAGER';
}

// ======================================================================
// قرارات الصلاحيات على المشاريع
// ======================================================================

/**
 * هل يحق له إدارة المشاريع التشغيلية؟
 * - المدير فقط
 */
function canManageProjects(activeRole) {
  return activeRole === 'MANAGER';
}

/**
 * هل يحق له تعيين مشرفين؟ (المدير فقط)
 */
function canAssignSupervisor(activeRole) {
  return activeRole === 'MANAGER';
}

// ======================================================================
// قرارات الصلاحيات على سجل التدقيق
// ======================================================================

/**
 * هل يحق له الاطلاع على سجل التدقيق؟
 * - المدير: كامل السجل
 * - مشرف المشروع: سجل مشروعه فقط
 */
function canViewAuditLog(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

// ======================================================================
// بناة استعلام «وير» (where) حسب الدور
// ======================================================================

/**
 * بناء شرط «وير» لاستعلام الدورات حسب دور المستخدم النشط
 */
async function buildCoursesWhere(user, activeRole, extraWhere = {}) {
  const base = { ...extraWhere };

  if (activeRole === 'MANAGER') return base;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    base.OR = [
      { operationalProjectId: { in: supervisedIds } },
      { primaryEmployeeId: user.id },
      { supportingTeam: { some: { userId: user.id } } },
    ];
    return base;
  }

  // EMPLOYEE
  base.OR = [
    { primaryEmployeeId: user.id },
    { supportingTeam: { some: { userId: user.id } } },
  ];
  return base;
}

/**
 * بناء شرط «وير» لاستعلام المستخدمين
 */
async function buildUsersWhere(user, activeRole, extraWhere = {}) {
  const base = { ...extraWhere };

  if (activeRole === 'MANAGER') return base;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    base.operationalProjectId = { in: supervisedIds };
    return base;
  }

  // موظف: زملاؤه في نفس المشروع فقط
  base.operationalProjectId = user.operationalProjectId;
  base.isActive = true;
  return base;
}

module.exports = {
  // مساعدات
  getSupervisedProjectIds,
  isSupervisorOf,
  resolveActiveRole,

  // دورات
  canViewCourse,
  canEditCourse,
  canDeleteCourse,
  canCreateCourseInProject,
  canArchiveCourse,
  canReassignCourse,

  // عناصر إقفال
  canSubmitElement,
  canDecideElement,

  // مستخدمون
  canManageUser,
  canEvaluatePerformance,

  // مشاريع
  canManageProjects,
  canAssignSupervisor,

  // تدقيق
  canViewAuditLog,

  // بناة استعلام
  buildCoursesWhere,
  buildUsersWhere,
};
