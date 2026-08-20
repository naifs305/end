// =============================================================
// صلاحيات وحدة الدورات (RBAC Policy)
// تعتمد على خدمة الصلاحيات المشتركة (permissions) كمصدر واحد للقواعد
// المتعلقة بالدورات. تُعرَض هنا لتستهلكها خدمة الوحدة.
// =============================================================
const permissions = require('../../services/permissions');

module.exports = {
  canViewCourse: permissions.canViewCourse,
  canCreateCourseInProject: permissions.canCreateCourseInProject,
  canEditCourse: permissions.canEditCourse,
  canDeleteCourse: permissions.canDeleteCourse,
  canArchiveCourse: permissions.canArchiveCourse,
  canReassignCourse: permissions.canReassignCourse,
  canSubmitElement: permissions.canSubmitElement,
  canDecideElement: permissions.canDecideElement,
  buildCoursesWhere: permissions.buildCoursesWhere,
};
