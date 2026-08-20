// =============================================================
// صلاحيات وحدة الإقفال (RBAC Policy)
// تعتمد على خدمة الصلاحيات المشتركة (permissions) كمصدر واحد لقواعد
// تنفيذ/اعتماد عناصر الإقفال وعرض الدورات.
// =============================================================
const permissions = require('../../services/permissions');

module.exports = {
  canSubmitElement: permissions.canSubmitElement,
  canDecideElement: permissions.canDecideElement,
  canViewCourse: permissions.canViewCourse,
};
