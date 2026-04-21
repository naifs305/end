export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  PROJECT_SUPERVISOR: 'PROJECT_SUPERVISOR',
  MANAGER: 'MANAGER',
  QUALITY_VIEWER: 'QUALITY_VIEWER',
};

export const ROLE_LABELS = {
  EMPLOYEE: 'موظف',
  PROJECT_SUPERVISOR: 'مشرف مشروع',
  MANAGER: 'مدير',
  QUALITY_VIEWER: 'جودة',
};

export const ROLE_ICONS = {
  EMPLOYEE: '👤',
  PROJECT_SUPERVISOR: '🎯',
  MANAGER: '👑',
  QUALITY_VIEWER: '🧾',
};

export function isAdminRole(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

export function canDecideElements(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

export function canManageUsers(activeRole) {
  return activeRole === 'MANAGER';
}

export function canEvaluatePerformance(activeRole) {
  return activeRole === 'MANAGER';
}

export function canManageProjects(activeRole) {
  return activeRole === 'MANAGER';
}

export function canViewReportsOnly(activeRole) {
  return activeRole === 'QUALITY_VIEWER';
}

export function getDefaultRole(userRoles) {
  if (!userRoles || userRoles.length === 0) return 'EMPLOYEE';
  if (userRoles.includes('MANAGER')) return 'MANAGER';
  if (userRoles.includes('PROJECT_SUPERVISOR')) return 'PROJECT_SUPERVISOR';
  if (userRoles.includes('QUALITY_VIEWER')) return 'QUALITY_VIEWER';
  return 'EMPLOYEE';
}

export function translateRole(role) {
  return ROLE_LABELS[role] || role;
}

export function translateRoles(roles) {
  if (!roles || roles.length === 0) return 'لا يوجد';
  return roles.map(translateRole).join(' / ');
}

export function getAllRoles() {
  return [
    { value: 'EMPLOYEE', label: 'موظف', description: 'يُسند له دورات وينفذ عناصر الإقفال' },
    { value: 'PROJECT_SUPERVISOR', label: 'مشرف مشروع', description: 'يعتمد عناصر إقفال دورات مشروعه' },
    { value: 'MANAGER', label: 'مدير', description: 'صلاحيات كاملة وتقييم أداء' },
    { value: 'QUALITY_VIEWER', label: 'جودة', description: 'عرض تقارير الافتتاح والاختتام والطباعة فقط' },
  ];
}
