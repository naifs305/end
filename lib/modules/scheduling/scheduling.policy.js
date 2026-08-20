// =============================================================
// صلاحيات وحدة الجدولة (RBAC Policy)
// إدارة المهام تتطلّب صلاحية المدير (يُفرض أيضاً عبر حارس المسار withManager).
// =============================================================
const { AppError } = require('../../shared/AppError');

function canManage(activeRole) {
  return activeRole === 'MANAGER';
}

function assertCanManage(activeRole) {
  if (!canManage(activeRole)) {
    throw AppError.forbidden('يتطلب صلاحية المدير', 'serverErrors.common.managerRequired');
  }
}

module.exports = { canManage, assertCanManage };
