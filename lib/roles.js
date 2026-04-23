export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  PROJECT_SUPERVISOR: 'PROJECT_SUPERVISOR',
  MANAGER: 'MANAGER',
  QUALITY_VIEWER: 'QUALITY_VIEWER',
};

export function normalizeRoles(userOrRoles) {
  if (Array.isArray(userOrRoles)) return userOrRoles;
  return userOrRoles?.roles || [];
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

export function canManageUsers(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR].includes(role);
}

export function canManageProjects(role) {
  return role === ROLES.MANAGER;
}

export function canAssignSupervisor(role) {
  return role === ROLES.MANAGER;
}

export function canEvaluateOthers(role) {
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

export function getDefaultRole(roles) {
  const normalized = normalizeRoles(roles);
  if (normalized.includes(ROLES.MANAGER)) return ROLES.MANAGER;
  if (normalized.includes(ROLES.PROJECT_SUPERVISOR)) return ROLES.PROJECT_SUPERVISOR;
  if (normalized.includes(ROLES.QUALITY_VIEWER)) return ROLES.QUALITY_VIEWER;
  return ROLES.EMPLOYEE;
}
