// =============================================================
// مكتبة مساعدات الأدوار
// -------------------------------------------------------------
// تُستخدم في الواجهة لتوحيد معاملة الأدوار الثلاثة
// =============================================================

export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  PROJECT_SUPERVISOR: 'PROJECT_SUPERVISOR',
  MANAGER: 'MANAGER',
};

export const ROLE_LABELS = {
  EMPLOYEE: 'موظف',
  PROJECT_SUPERVISOR: 'مشرف مشروع',
  MANAGER: 'مدير',
};

export const ROLE_ICONS = {
  EMPLOYEE: '👤',
  PROJECT_SUPERVISOR: '🎯',
  MANAGER: '👑',
};

/**
 * هل الدور النشط يملك صلاحيات إدارية (المدير أو المشرف)؟
 */
export function isAdminRole(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

/**
 * هل الدور النشط يملك صلاحية اعتماد عناصر الإقفال؟
 */
export function canDecideElements(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

/**
 * هل الدور النشط يملك صلاحية إدارة المستخدمين؟
 */
export function canManageUsers(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

/**
 * هل الدور النشط يملك صلاحية تقييم الأداء؟
 * (المدير فقط)
 */
export function canEvaluatePerformance(activeRole) {
  return activeRole === 'MANAGER';
}

/**
 * هل الدور النشط يملك صلاحية إدارة المشاريع؟
 * (المدير فقط)
 */
export function canManageProjects(activeRole) {
  return activeRole === 'MANAGER';
}

/**
 * ترتيب الأدوار من الأعلى للأدنى (لأولوية الاختيار الافتراضي)
 */
export function getDefaultRole(userRoles) {
  if (!userRoles || userRoles.length === 0) return 'EMPLOYEE';
  if (userRoles.includes('MANAGER')) return 'MANAGER';
  if (userRoles.includes('PROJECT_SUPERVISOR')) return 'PROJECT_SUPERVISOR';
  return 'EMPLOYEE';
}

/**
 * ترجمة اسم الدور للعربية
 */
export function translateRole(role) {
  return ROLE_LABELS[role] || role;
}

/**
 * ترجمة مصفوفة أدوار إلى نص مقروء
 */
export function translateRoles(roles) {
  if (!roles || roles.length === 0) return 'لا يوجد';
  return roles.map(translateRole).join(' / ');
}

/**
 * قائمة الأدوار المتاحة لعرضها في نماذج الإدارة
 */
export function getAllRoles() {
  return [
    { value: 'EMPLOYEE', label: 'موظف', description: 'يُسند له دورات وينفذ عناصر الإقفال' },
    { value: 'PROJECT_SUPERVISOR', label: 'مشرف مشروع', description: 'يعتمد عناصر إقفال دورات مشروعه' },
    { value: 'MANAGER', label: 'مدير', description: 'صلاحيات كاملة وتقييم أداء' },
  ];
}
