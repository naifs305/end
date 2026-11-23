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


// ── من يراجع عناصر الدورة؟ ─────────────────────────────────
// • المنسق المتعاون: لا ينتمي لمشروع ومرجعه المدير، فدوراته يتولاها
//   المشرف الذي أسند إليه المدير متابعته (إن أسنده).
// • الدورة الخارجية: تُنسب لمشروعها في الإحصاء، لكن مراجعة عناصرها
//   وتدقيقها لمشرف مشروع منسّقها نفسه — لا لمشرف مشروع الدورة. فلو
//   كُلّف منسق من مشروع «أ» بدورة خارجية تتبع مشروع «ب» راجعه مشرف «أ».
// • ما سواهما: يتولاه مشرف مشروع الدورة كما كان.
const EXTERNAL = 'external';

function reviewProjectIdOf(course, owner) {
  if (!course) return null;
  if (course.courseType === EXTERNAL && owner && !owner.isCollaborator && owner.operationalProjectId) {
    return owner.operationalProjectId;
  }
  return course.operationalProjectId || null;
}

const OWNER_FIELDS = ['isCollaborator', 'followUpSupervisorId', 'operationalProjectId'];

// يُكمل ما ينقص الدورة من حقول يحتاجها تحديد المراجِع
async function loadReviewContext(course) {
  let c = course;
  if (c.courseType === undefined || c.operationalProjectId === undefined || c.primaryEmployeeId === undefined) {
    const row = c.id
      ? await prisma.course.findUnique({ where: { id: c.id }, select: { courseType: true, operationalProjectId: true, primaryEmployeeId: true } })
      : null;
    c = { ...row, ...Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) };
  }
  const pe = c.primaryEmployee;
  const owner = pe && OWNER_FIELDS.every((f) => f in pe)
    ? pe
    : c.primaryEmployeeId
      ? await prisma.user.findUnique({ where: { id: c.primaryEmployeeId }, select: { isCollaborator: true, followUpSupervisorId: true, operationalProjectId: true } })
      : null;
  return { course: c, owner };
}

async function supervisesCourse(userId, course) {
  if (!course) return false;
  const { course: c, owner } = await loadReviewContext(course);
  if (owner?.isCollaborator) return !!owner.followUpSupervisorId && owner.followUpSupervisorId === userId;
  return isSupervisorOf(userId, reviewProjectIdOf(c, owner));
}

// مشرفو الدورة الذين يراجعون عناصرها (فارغة = يتولاها المدير)
async function findCourseSupervisorIds(course) {
  if (!course) return [];
  const { course: c, owner } = await loadReviewContext(course);
  if (owner?.isCollaborator) return owner.followUpSupervisorId ? [owner.followUpSupervisorId] : [];
  const projectId = reviewProjectIdOf(c, owner);
  if (!projectId) return [];
  const rows = await prisma.projectSupervisor.findMany({ where: { operationalProjectId: projectId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

// شرط الدورات التي يراجعها مشرف — بالقاعدة نفسها
function supervisedCoursesClauses(userId, supervisedIds) {
  return [
    // دورات مشاريعه غير الخارجية — إلا دورات المتعاونين، فلها مشرفها المسند
    { courseType: { not: EXTERNAL }, operationalProjectId: { in: supervisedIds }, primaryEmployee: { isCollaborator: false } },
    // الدورات الخارجية لمنسقي مشاريعه، أيّاً كان مشروع الدورة
    { courseType: EXTERNAL, primaryEmployee: { isCollaborator: false, operationalProjectId: { in: supervisedIds } } },
    // خارجية لمنسق بلا مشروع: تبقى لمشرف مشروع الدورة
    { courseType: EXTERNAL, operationalProjectId: { in: supervisedIds }, primaryEmployee: { isCollaborator: false, operationalProjectId: null } },
    { primaryEmployee: { followUpSupervisorId: userId } },
  ];
}

// يتابع المشرف المستخدم إن كان في مشروع يشرف عليه، أو متعاوناً أُسند إليه
async function supervisesUser(userId, targetUser) {
  if (!targetUser) return false;
  if (targetUser.followUpSupervisorId && targetUser.followUpSupervisorId === userId) return true;
  if (targetUser.isCollaborator) return false;
  return isSupervisorOf(userId, targetUser.operationalProjectId);
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
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR' && await supervisesCourse(user.id, course)) return true;
  if (course.primaryEmployeeId === user.id) return true;
  const supporting = await prisma.courseSupport.findFirst({ where: { courseId: course.id, userId: user.id }, select: { id: true } });
  if (supporting) return true;
  // المنسق المسند إليه مراجعة شهادات الدورة يطّلع عليها ليراجعها
  const reviewing = await prisma.courseClosureTracking.findFirst({
    where: { courseId: course.id, element: { key: 'certificates' }, formData: { path: ['certReview', 'reviewerId'], equals: user.id } },
    select: { id: true },
  });
  return !!reviewing;
}

async function canCreateCourseInProject(user, activeRole, operationalProjectId) {
  if (!operationalProjectId) return false;
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') return isSupervisorOf(user.id, operationalProjectId);
  return activeRole === 'EMPLOYEE';
}

async function canEditCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return { allowed: true };
  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (await supervisesCourse(user.id, course)) return { allowed: true };
    return { allowed: false, reason: 'أنت لا تشرف على هذا المشروع' };
  }
  if (course.primaryEmployeeId !== user.id) return { allowed: false, reason: 'لا تملك صلاحية تعديل هذه الدورة' };
  if (course.status !== 'PREPARATION') return { allowed: false, reason: 'الموظف لا يعدل الدورة بعد مرحلة الإعداد' };
  return { allowed: true };
}

async function canDeleteCourse(user, activeRole, course) {
  return canEditCourse(user, activeRole, course);
}

async function canArchiveCourse(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') return supervisesCourse(user.id, course);
  return false;
}

async function canReassignCourse(user, activeRole, course) {
  return canArchiveCourse(user, activeRole, course);
}

async function canSubmitElement(user, activeRole, course) {
  if (course.primaryEmployeeId === user.id) return true;
  if (activeRole === 'MANAGER') return false;
  const supporting = await prisma.courseSupport.findFirst({ where: { courseId: course.id, userId: user.id }, select: { id: true } });
  return !!supporting;
}

async function canDecideElement(user, activeRole, course) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') return supervisesCourse(user.id, course);
  return false;
}

async function canResetUserPassword(user, activeRole, targetUser) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (targetUser.roles?.includes('MANAGER')) return false;
    return supervisesUser(user.id, targetUser);
  }
  return false;
}

async function canEditUserBasicInfo(user, activeRole, targetUser) {
  if (activeRole === 'MANAGER') return true;
  if (activeRole === 'PROJECT_SUPERVISOR') {
    if (targetUser.roles?.includes('MANAGER')) return false;
    return supervisesUser(user.id, targetUser);
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
  if (activeRole === 'MANAGER') return { ...extraWhere };
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    return {
      ...extraWhere,
      OR: [
        ...supervisedCoursesClauses(user.id, supervisedIds),
        { primaryEmployeeId: user.id },
        { supportingTeam: { some: { userId: user.id } } },
      ],
    };
  }
  return {
    ...extraWhere,
    OR: [
      { primaryEmployeeId: user.id },
      { supportingTeam: { some: { userId: user.id } } },
    ],
  };
}

async function buildUsersWhere(user, activeRole, extraWhere = {}) {
  if (activeRole === 'MANAGER') return { ...extraWhere };
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    return {
      ...extraWhere,
      OR: [
        { operationalProjectId: { in: supervisedIds }, isCollaborator: false },
        { followUpSupervisorId: user.id },
      ],
    };
  }
  return { ...extraWhere, id: user.id };
}

async function buildAuditWhere(user, activeRole, extraWhere = {}) {
  if (activeRole === 'MANAGER') return { ...extraWhere };
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const supervisedIds = await getSupervisedProjectIds(user.id);
    return {
      ...extraWhere,
      course: { OR: supervisedCoursesClauses(user.id, supervisedIds) },
    };
  }
  return { ...extraWhere, userId: user.id };
}

module.exports = {
  getSupervisedProjectIds,
  getPrimarySupervisedProjectId,
  isSupervisorOf,
  supervisesCourse,
  supervisesUser,
  reviewProjectIdOf,
  findCourseSupervisorIds,
  supervisedCoursesClauses,
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
