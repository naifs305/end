// =============================================================
// صلاحيات وحدة التقارير (RBAC Policy)
// الوصول إلى قائمة التقارير مقصور على الأدوار المصرّح لها.
// =============================================================
const { AppError } = require('../../shared/AppError');

const ALLOWED_ROLES = ['MANAGER', 'PROJECT_SUPERVISOR', 'EMPLOYEE', 'QUALITY_VIEWER'];

function canListReports(activeRole) {
  return ALLOWED_ROLES.includes(activeRole);
}

function assertCanListReports(activeRole) {
  if (!canListReports(activeRole)) {
    throw AppError.forbidden('غير مصرح لك بالوصول إلى التقارير', 'serverErrors.reports.accessForbidden');
  }
}

module.exports = { canListReports, assertCanListReports };
