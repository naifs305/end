export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  PROJECT_SUPERVISOR: 'PROJECT_SUPERVISOR',
  MANAGER: 'MANAGER',
  QUALITY_VIEWER: 'QUALITY_VIEWER',
};

export function normalizeRoles(userOrRoles) {
  if (Array.isArray(userOrRoles)) return userOrRoles.filter(Boolean);
  return Array.isArray(userOrRoles?.roles) ? userOrRoles.roles.filter(Boolean) : [];
}

export function hasRole(userOrRoles, role) {
  return normalizeRoles(userOrRoles).includes(role);
}

export function isEmployeeRole(role) {
  return role === ROLES.EMPLOYEE;
}

export function isSupervisorRole(role) {
  return role === ROLES.PROJECT_SUPERVISOR;
}

export function isAdminRole(role) {
  return role === ROLES.MANAGER;
}

export function isQualityViewerRole(role) {
  return role === ROLES.QUALITY_VIEWER;
}

export function translateRole(role) {
  switch (role) {
    case ROLES.MANAGER:
      return 'مدير';
    case ROLES.PROJECT_SUPERVISOR:
      return 'مشرف مشروع';
    case ROLES.QUALITY_VIEWER:
      return 'الجودة';
    case ROLES.EMPLOYEE:
    default:
      return 'موظف';
  }
}

export function getDefaultRole(userOrRoles) {
  const roles = normalizeRoles(userOrRoles);
  if (roles.includes(ROLES.MANAGER)) return ROLES.MANAGER;
  if (roles.includes(ROLES.PROJECT_SUPERVISOR)) return ROLES.PROJECT_SUPERVISOR;
  if (roles.includes(ROLES.QUALITY_VIEWER)) return ROLES.QUALITY_VIEWER;
  return ROLES.EMPLOYEE;
}

export function canManageUsers(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR].includes(role);
}

export function canManageProjects(role) {
  return role === ROLES.MANAGER;
}

export function canAssignSupervisor(role) {
  return role === ROLES.MANAGER;
}

export function canViewReports(role) {
  return [
    ROLES.MANAGER,
    ROLES.PROJECT_SUPERVISOR,
    ROLES.EMPLOYEE,
    ROLES.QUALITY_VIEWER,
  ].includes(role);
}

export function canViewReportsOnly(role) {
  return role === ROLES.QUALITY_VIEWER;
}

export function canPrintReports(role) {
  return canViewReports(role);
}

export function canAccessAudit(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR].includes(role);
}

export function canAccessKpis(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR, ROLES.EMPLOYEE].includes(role);
}

export function canEvaluateOthers(role) {
  return role === ROLES.MANAGER;
}

export function canEvaluatePerformance(role) {
  return role === ROLES.MANAGER;
}

export function canCreateCourse(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR, ROLES.EMPLOYEE].includes(role);
}
