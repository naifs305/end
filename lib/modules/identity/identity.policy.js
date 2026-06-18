// =============================================================
// صلاحيات وحدة الهوية (RBAC Policy)
// تُعيد استخدام مساعدات lib/services/permissions المشتركة (لا تكررها)،
// وتضيف نسخ assert* التي تُلقي AppError بنفس الرموز والحالات الأصلية.
// =============================================================
const { AppError } = require('../../shared/AppError');
const permissions = require('../../services/permissions');

// -------- can* (تغليف رقيق للمساعدات المشتركة) --------

function canEditUserBasicInfo(actorUser, activeRole, targetUser) {
  return permissions.canEditUserBasicInfo(actorUser, activeRole, targetUser);
}

function canResetUserPassword(actorUser, activeRole, targetUser) {
  return permissions.canResetUserPassword(actorUser, activeRole, targetUser);
}

function canChangeUserRoles(activeRole) {
  return permissions.canChangeUserRoles(activeRole);
}

function canAssignSupervisor(activeRole) {
  return permissions.canAssignSupervisor(activeRole);
}

// -------- assert* (تُلقي AppError بنفس الرموز/الحالات الأصلية) --------

async function assertCanEditUserBasicInfo(actorUser, activeRole, targetUser, { code } = {}) {
  const allowed = await canEditUserBasicInfo(actorUser, activeRole, targetUser);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية تعديل هذا المستخدم', code || 'serverErrors.users.forbiddenEdit');
  }
}

async function assertCanViewUser(actorUser, activeRole, targetUser) {
  // نفس قاعدة التعديل تُستخدم للعرض (كما في المسار الأصلي)
  const allowed = await canEditUserBasicInfo(actorUser, activeRole, targetUser);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية عرض هذا المستخدم', 'serverErrors.users.forbiddenView');
  }
}

async function assertCanResetUserPassword(actorUser, activeRole, targetUser) {
  const allowed = await canResetUserPassword(actorUser, activeRole, targetUser);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية إعادة التعيين', 'serverErrors.users.forbiddenResetPassword');
  }
}

function assertCanChangeUserRoles(activeRole) {
  if (!canChangeUserRoles(activeRole)) {
    throw AppError.forbidden('يتطلب صلاحية المدير', 'serverErrors.common.managerRequired');
  }
}

module.exports = {
  canEditUserBasicInfo,
  canResetUserPassword,
  canChangeUserRoles,
  canAssignSupervisor,
  assertCanEditUserBasicInfo,
  assertCanViewUser,
  assertCanResetUserPassword,
  assertCanChangeUserRoles,
};
