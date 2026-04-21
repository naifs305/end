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

export const ROLE_ORDER = ['MANAGER', 'PROJECT_SUPERVISOR', 'EMPLOYEE'];

export function isAdminRole(activeRole) {
  return activeRole === ROLES.MANAGER || activeRole === ROLES.PROJECT_SUPERVISOR;
}

export function isManagerRole(activeRole) {
  return activeRole === ROLES.MANAGER;
}

export function isProjectSupervisorRole(activeRole) {
  return activeRole === ROLES.PROJECT_SUPERVISOR;
}

export function canDecideElements(activeRole) {
  return isAdminRole(activeRole);
}

export function canManageProjects(activeRole) {
  return isManagerRole(activeRole);
}

export function canEvaluatePerformance(activeRole) {
  return isManagerRole(activeRole);
}

export function canChangeUserRoles(activeRole) {
  return isManagerRole(activeRole);
}

export function canResetPasswords(activeRole) {
  return isAdminRole(activeRole);
}

export function getDefaultRole(userRoles) {
  if (!Array.isArray(userRoles) || userRoles.length === 0) return ROLES.EMPLOYEE;

  for (const role of ROLE_ORDER) {
    if (userRoles.includes(role)) return role;
  }

  return userRoles[0] || ROLES.EMPLOYEE;
}

export function translateRole(role) {
  return ROLE_LABELS[role] || role;
}

export function translateRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return 'لا يوجد';
  return roles.map(translateRole).join(' / ');
}

export function getAllRoles() {
  return [
    {
      value: ROLES.EMPLOYEE,
      label: ROLE_LABELS.EMPLOYEE,
      description: 'ينفذ الدورات وعناصر الإقفال الموكلة إليه',
    },
    {
      value: ROLES.PROJECT_SUPERVISOR,
      label: ROLE_LABELS.PROJECT_SUPERVISOR,
      description: 'يشرف على مشروع واحد ويعتمد عناصر دورات مشروعه',
    },
    {
      value: ROLES.MANAGER,
      label: ROLE_LABELS.MANAGER,
      description: 'صلاحيات كاملة ويقيّم الأداء ويدير المشاريع والأدوار',
    },
  ];
}
