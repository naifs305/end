// =============================================================
// صلاحيات وحدة الإعدادات (RBAC Policy)
// مصدر واحد لقواعد الوصول — يُستهلَك من الخدمة (وحارس المسار طبقة إضافية).
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
