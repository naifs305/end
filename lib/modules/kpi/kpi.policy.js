// =============================================================
// صلاحيات وحدة مؤشرات الأداء (RBAC Policy)
// مصدر واحد لقواعد الوصول التي تفرضها مسارات الـ KPI/Analytics.
// تُستهلَك من الخدمة (وحارس المسار طبقة إضافية للدفاع في العمق).
// =============================================================
const { AppError } = require('../../shared/AppError');

function isManager(activeRole) {
  return activeRole === 'MANAGER';
}

// المدير فقط يحرّر سجلّات الإسناد
function assertCanEditAssignment(activeRole) {
  if (!isManager(activeRole)) {
    throw AppError.forbidden('يتطلب صلاحية المدير للتعديل', 'serverErrors.kpis.managerRequiredToEdit');
  }
}

// المشرف لا يرى إلا مشاريعه
function assertProjectAccess(activeRole, projectId, supervisedProjectIds = []) {
  if (activeRole === 'PROJECT_SUPERVISOR' && !supervisedProjectIds.includes(projectId)) {
    throw AppError.forbidden('غير مصرح لك بعرض بيانات هذا المشروع', 'serverErrors.kpis.projectAccessDenied');
  }
}

module.exports = {
  isManager,
  assertCanEditAssignment,
  assertProjectAccess,
};
