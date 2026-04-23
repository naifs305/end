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

export function isAdminRole(activeRole) {
  return activeRole === ROLES.MANAGER || activeRole === ROLES.PROJECT_SUPERVISOR;
}

export function canDecideElements(activeRole) {
  return activeRole === ROLES.MANAGER || activeRole === ROLES.PROJECT_SUPERVISOR;
}

export function canManageUsers(activeRole) {
  return activeRole === ROLES.MANAGER;
}

export function canEvaluatePerformance(activeRole) {
  return activeRole === ROLES.MANAGER;
}

export function canManageProjects(activeRole) {
  return activeRole === ROLES.MANAGER;
}

export function canViewReports(activeRole) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR, ROLES.EMPLOYEE, ROLES.QUALITY_VIEWER].includes(activeRole);
}

export function canViewOnlyQualityReports(activeRole) {
  return activeRole === ROLES.QUALITY_VIEWER;
}

export function getDefaultRole(userRoles) {
  if (!userRoles || userRoles.length === 0) return ROLES.EMPLOYEE;
  if (userRoles.includes(ROLES.MANAGER)) return ROLES.MANAGER;
  if (userRoles.includes(ROLES.PROJECT_SUPERVISOR)) return ROLES.PROJECT_SUPERVISOR;
  if (userRoles.includes(ROLES.QUALITY_VIEWER)) return ROLES.QUALITY_VIEWER;
  return ROLES.EMPLOYEE;
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
    { value: ROLES.EMPLOYEE, label: 'موظف', description: 'يُسند له دورات وينفذ عناصر الإقفال' },
    { value: ROLES.PROJECT_SUPERVISOR, label: 'مشرف مشروع', description: 'يعتمد عناصر إقفال دورات مشروعه' },
    { value: ROLES.MANAGER, label: 'مدير', description: 'صلاحيات كاملة وتقييم أداء' },
    { value: ROLES.QUALITY_VIEWER, label: 'جودة', description: 'يطلع على تقارير الافتتاح والاختتام ويطبعها فقط' },
  ];
}
