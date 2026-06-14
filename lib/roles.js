export const ROLES = {
  EMPLOYEE: 'EMPLOYEE',
  PROJECT_SUPERVISOR: 'PROJECT_SUPERVISOR',
  MANAGER: 'MANAGER',
  QUALITY_VIEWER: 'QUALITY_VIEWER',
};

const ROLE_ALIASES = {
  EMPLOYEE: ROLES.EMPLOYEE,
  employee: ROLES.EMPLOYEE,
  موظف: ROLES.EMPLOYEE,

  PROJECT_SUPERVISOR: ROLES.PROJECT_SUPERVISOR,
  project_supervisor: ROLES.PROJECT_SUPERVISOR,
  SUPERVISOR: ROLES.PROJECT_SUPERVISOR,
  supervisor: ROLES.PROJECT_SUPERVISOR,
  'مشرف مشروع': ROLES.PROJECT_SUPERVISOR,
  مشرف: ROLES.PROJECT_SUPERVISOR,

  MANAGER: ROLES.MANAGER,
  manager: ROLES.MANAGER,
  مدير: ROLES.MANAGER,

  QUALITY_VIEWER: ROLES.QUALITY_VIEWER,
  quality_viewer: ROLES.QUALITY_VIEWER,
  QUALITY: ROLES.QUALITY_VIEWER,
  quality: ROLES.QUALITY_VIEWER,
  الجودة: ROLES.QUALITY_VIEWER,
};

export function normalizeRole(role) {
  if (!role) return null;
  return ROLE_ALIASES[role] || role;
}

export function normalizeRoles(userOrRoles) {
  if (Array.isArray(userOrRoles)) return userOrRoles.map(normalizeRole).filter(Boolean);
  return Array.isArray(userOrRoles?.roles) ? userOrRoles.roles.map(normalizeRole).filter(Boolean) : [];
}

export function hasRole(userOrRoles, role) {
  return normalizeRoles(userOrRoles).includes(normalizeRole(role));
}

export function isEmployeeRole(role) {
  return normalizeRole(role) === ROLES.EMPLOYEE;
}

export function isSupervisorRole(role) {
  return normalizeRole(role) === ROLES.PROJECT_SUPERVISOR;
}

export function isAdminRole(role) {
  return normalizeRole(role) === ROLES.MANAGER;
}

export function isQualityViewerRole(role) {
  return normalizeRole(role) === ROLES.QUALITY_VIEWER;
}

export function translateRole(role) {
  switch (normalizeRole(role)) {
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
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR].includes(normalizeRole(role));
}

export function canManageProjects(role) {
  return normalizeRole(role) === ROLES.MANAGER;
}

export function canAssignSupervisor(role) {
  return normalizeRole(role) === ROLES.MANAGER;
}

export function canViewReports(role) {
  return [
    ROLES.MANAGER,
    ROLES.PROJECT_SUPERVISOR,
    ROLES.EMPLOYEE,
    ROLES.QUALITY_VIEWER,
  ].includes(normalizeRole(role));
}

export function canViewReportsOnly(role) {
  return normalizeRole(role) === ROLES.QUALITY_VIEWER;
}

export function canPrintReports(role) {
  return canViewReports(role);
}

export function canAccessAudit(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR].includes(normalizeRole(role));
}

export function canAccessKpis(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR, ROLES.EMPLOYEE].includes(normalizeRole(role));
}

export function canEvaluateOthers(role) {
  return normalizeRole(role) === ROLES.MANAGER;
}

export function canEvaluatePerformance(role) {
  return normalizeRole(role) === ROLES.MANAGER;
}

export function canCreateCourse(role) {
  return [ROLES.MANAGER, ROLES.PROJECT_SUPERVISOR, ROLES.EMPLOYEE].includes(normalizeRole(role));
}
