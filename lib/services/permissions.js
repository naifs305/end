const prisma = require('../db/prisma');

async function getSupervisedProjectIds(userId) {
  const rows = await prisma.projectSupervisor.findMany({
    where: { userId },
    select: { operationalProjectId: true },
  });

  return rows.map((row) => row.operationalProjectId);
}

async function getPrimarySupervisedProjectId(userId) {
  const rows = await getSupervisedProjectIds(userId);
  return rows[0] || null;
}

async function isSupervisorOf(userId, operationalProjectId) {
  if (!operationalProjectId) return false;

  const row = await prisma.projectSupervisor.findFirst({
    where: { userId, operationalProjectId },
    select: { id: true },
  });

  return !!row;
}

function resolveActiveRole(user, headerRole) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];

  if (headerRole && roles.includes(headerRole)) return headerRole;
  if (roles.includes('MANAGER')) return 'MANAGER';
  if (roles.includes('PROJECT_SUPERVISOR')) return 'PROJECT_SUPERVISOR';
  if (roles.includes('EMPLOYEE')) return 'EMPLOYEE';

  return 'EMPLOYEE';
}

async function canViewCourse(user, activeRole, course) {
  if (!user || !course) return false;

  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (await isSupervisorOf(user.id, course.operationalProjectId)) return true;
  }

  if (course.primaryEmployeeId === user.id) return true;

  const supporting = await prisma.courseSupport.findFirst({
    where: { courseId: course.id, userId: user.id },
    select: { id: true },
  });

  return !!supporting;
}

async function canCreateCourseInProject(user, activeRole, operationalProjectId) {
  if (!user || !operationalProjectId) return false;

  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, operationalProjectId);
  }

  return user.operationalProjectId === operationalProjectId;
}

async function canEditCourse(user, activeRole, course) {
  if (!user || !course) {
    return { allowed: false, reason: 'الدورة أو المستخدم غير صالح' };
  }

  if (activeRole === 'MANAGER') return { allowed: true };

  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (await isSupervisorOf(user.id, course.operationalProjectId)) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'أنت لا تشرف على هذا المشروع' };
  }

  if (course.primaryEmployeeId !== user.id) {
    return { allowed: false, reason: 'لا تملك صلاحية تعديل هذه الدورة' };
  }

  if (course.status !== 'PREPARATION') {
    return { allowed: false, reason: 'الموظف لا يعدل الدورة بعد انتقالها من الإعداد' };
  }

  return { allowed: true };
}

async function canDeleteCourse(user, activeRole, course) {
  return canEditCourse(user, activeRole, course);
}

async function canArchiveCourse(user, activeRole, course) {
  if (!user || !course) return false;
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, course.operationalProjectId);
  }
  return false;
}

async function canReassignCourse(user, activeRole, course) {
  return canArchiveCourse(user, activeRole, course);
}

async function canSubmitElement(user, course) {
  if (!user || !course) return false;

  if (course.primaryEmployeeId === user.id) return true;

  const supporting = await prisma.courseSupport.findFirst({
    where: { courseId: course.id, userId: user.id },
    select: { id: true },
  });

  return !!supporting;
}

async function canDecideElement(user, activeRole, course) {
  if (!user || !course) return false;
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    return isSupervisorOf(user.id, course.operationalProjectId);
  }
  return false;
}

async function canResetUserPassword(user, activeRole, targetUser) {
  if (!user || !targetUser) return false;
  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (targetUser.roles?.includes('MANAGER')) return false;
    return isSupervisorOf(user.id, targetUser.operationalProjectId);
  }

  return false;
}

async function canEditUserBasicInfo(user, activeRole, targetUser) {
  if (!user || !targetUser) return false;
  if (activeRole === 'MANAGER') return true;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (targetUser.roles?.includes('MANAGER')) return false;
    return isSupervisorOf(user.id, targetUser.operationalProjectId);
  }

  return user.id === targetUser.id;
}

function canChangeUserRoles(activeRole) {
  return activeRole === 'MANAGER';
}

function canCreateProject(activeRole) {
  return activeRole === 'MANAGER';
}

function canUpdateProject(activeRole) {
  return activeRole === 'MANAGER';
}

function canDeleteProject(activeRole) {
  return activeRole === 'MANAGER';
}

function canAssignSupervisor(activeRole) {
  return activeRole === 'MANAGER';
}

function canEvaluatePerformance(activeRole) {
  return activeRole === 'MANAGER';
}

function canViewAuditLog(activeRole) {
  return activeRole === 'MANAGER' || activeRole === 'PROJECT_SUPERVISOR';
}

async function buildCoursesWhere(user, activeRole, extraWhere = {}) {
  const base = { ...extraWhere };

  if (activeRole === 'MANAGER') return base;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);

    return {
      ...base,
      OR: [
        { operationalProjectId: { in: supervisedIds } },
        { primaryEmployeeId: user.id },
        { supportingTeam: { some: { userId: user.id } } },
      ],
    };
  }

  return {
    ...base,
    OR: [
      { primaryEmployeeId: user.id },
      { supportingTeam: { some: { userId: user.id } } },
    ],
  };
}

async function buildUsersWhere(user, activeRole, extraWhere = {}) {
  const base = { ...extraWhere };

  if (activeRole === 'MANAGER') return base;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    return {
      ...base,
      operationalProjectId: { in: supervisedIds },
    };
  }

  return {
    ...base,
    id: user.id,
  };
}

async function buildAuditWhere(user, activeRole, extraWhere = {}) {
  const base = { ...extraWhere };

  if (activeRole === 'MANAGER') return base;

  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    return {
      ...base,
      course: {
        operationalProjectId: { in: supervisedIds },
      },
    };
  }

  return {
    ...base,
    userId: user.id,
  };
}

module.exports = {
  getSupervisedProjectIds,
  getPrimarySupervisedProjectId,
  isSupervisorOf,
  resolveActiveRole,
  canViewCourse,
  canCreateCourseInProject,
  canEditCourse,
  canDeleteCourse,
  canArchiveCourse,
  canReassignCourse,
  canSubmitElement,
  canDecideElement,
  canResetUserPassword,
  canEditUserBasicInfo,
  canChangeUserRoles,
  canCreateProject,
  canUpdateProject,
  canDeleteProject,
  canAssignSupervisor,
  canEvaluatePerformance,
  canViewAuditLog,
  buildCoursesWhere,
  buildUsersWhere,
  buildAuditWhere,
};
