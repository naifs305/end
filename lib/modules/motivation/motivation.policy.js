// =============================================================
// صلاحيات وحدة التحفيز (RBAC Policy)
// تحافظ على رموز/رسائل الأخطاء الأصلية بالحرف نفسه.
// =============================================================
const { AppError } = require('../../shared/AppError');

function assertManager(activeRole) {
  if (activeRole !== 'MANAGER') {
    throw new AppError('يتطلب صلاحية المدير', { code: 'serverErrors.motivation.managerRequired', statusCode: 403 });
  }
}

function assertManagerOrSupervisor(activeRole) {
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole)) {
    throw new AppError('غير مصرح', { code: 'serverErrors.common.forbidden', statusCode: 403 });
  }
}

module.exports = { assertManager, assertManagerOrSupervisor };
