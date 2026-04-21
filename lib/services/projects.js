// =============================================================
// خدمة إدارة المشاريع التشغيلية ومشرفيها
// =============================================================

const prisma = require('../db/prisma');
const { logAudit } = require('./audit');

// ======================================================================
// المشاريع التشغيلية
// ======================================================================

async function listProjects() {
  return prisma.operationalProject.findMany({
    orderBy: { name: 'asc' },
    include: {
      supervisors: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      _count: { select: { users: true, courses: true } },
    },
  });
}

async function getProject(id) {
  const project = await prisma.operationalProject.findUnique({
    where: { id },
    include: {
      supervisors: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
      _count: { select: { users: true, courses: true } },
    },
  });

  if (!project) {
    const err = new Error('المشروع غير موجود');
    err.statusCode = 404;
    throw err;
  }
  return project;
}

async function createProject(name, managerId) {
  if (!name?.trim()) {
    const err = new Error('اسم المشروع مطلوب');
    err.statusCode = 400;
    throw err;
  }

  const existing = await prisma.operationalProject.findUnique({ where: { name: name.trim() } });
  if (existing) {
    const err = new Error('يوجد مشروع بهذا الاسم');
    err.statusCode = 400;
    throw err;
  }

  const project = await prisma.operationalProject.create({
    data: { name: name.trim() },
  });

  await logAudit(managerId, 'MANAGER', 'PROJECT_CREATED', { projectName: project.name });
  return project;
}

async function updateProject(id, name, managerId) {
  if (!name?.trim()) {
    const err = new Error('اسم المشروع مطلوب');
    err.statusCode = 400;
    throw err;
  }

  const project = await prisma.operationalProject.update({
    where: { id },
    data: { name: name.trim() },
  });

  await logAudit(managerId, 'MANAGER', 'PROJECT_UPDATED', { projectName: project.name });
  return project;
}

async function deleteProject(id, managerId) {
  const project = await prisma.operationalProject.findUnique({
    where: { id },
    include: { _count: { select: { users: true, courses: true } } },
  });

  if (!project) {
    const err = new Error('المشروع غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (project._count.users > 0 || project._count.courses > 0) {
    const err = new Error('لا يمكن حذف مشروع به مستخدمون أو دورات');
    err.statusCode = 400;
    throw err;
  }

  await prisma.operationalProject.delete({ where: { id } });
  await logAudit(managerId, 'MANAGER', 'PROJECT_DELETED', { projectName: project.name });
  return { success: true };
}

// ======================================================================
// مشرفو المشاريع
// ======================================================================

/**
 * تعيين مشرف لمشروع.
 * إذا كان المستخدم لا يحمل دور PROJECT_SUPERVISOR بعد، نضيف الدور.
 * إذا كان يشرف على مشروع آخر، نمنع التعيين (مشرف واحد لكل شخص).
 */
async function assignSupervisor(userId, operationalProjectId, managerId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const project = await prisma.operationalProject.findUnique({
    where: { id: operationalProjectId },
  });
  if (!project) {
    const err = new Error('المشروع غير موجود');
    err.statusCode = 404;
    throw err;
  }

  // التحقق من عدم إشراف المستخدم على مشروع آخر
  const existing = await prisma.projectSupervisor.findUnique({ where: { userId } });
  if (existing && existing.operationalProjectId !== operationalProjectId) {
    const err = new Error('المستخدم يشرف بالفعل على مشروع آخر — لا يمكن الإشراف على مشروعين');
    err.statusCode = 400;
    throw err;
  }

  // إنشاء علاقة الإشراف (أو تجاهل إن كانت موجودة)
  const supervision = await prisma.projectSupervisor.upsert({
    where: { userId },
    update: { operationalProjectId, createdById: managerId },
    create: { userId, operationalProjectId, createdById: managerId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      operationalProject: true,
    },
  });

  // إضافة دور PROJECT_SUPERVISOR إن لم يكن موجوداً
  if (!user.roles.includes('PROJECT_SUPERVISOR')) {
    await prisma.user.update({
      where: { id: userId },
      data: { roles: { push: 'PROJECT_SUPERVISOR' } },
    });
  }

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_ASSIGNED', {
    userId,
    userName: `${user.firstName} ${user.lastName}`,
    projectId: operationalProjectId,
    projectName: project.name,
  });

  return supervision;
}

/**
 * إزالة مشرف من مشروع.
 * تُزيل الدور أيضاً (لأن المستخدم لم يعد مشرفاً على أي مشروع).
 */
async function unassignSupervisor(userId, managerId) {
  const supervision = await prisma.projectSupervisor.findUnique({
    where: { userId },
    include: {
      user: { select: { firstName: true, lastName: true, roles: true } },
      operationalProject: true,
    },
  });

  if (!supervision) {
    const err = new Error('المستخدم ليس مشرفاً على أي مشروع');
    err.statusCode = 404;
    throw err;
  }

  await prisma.projectSupervisor.delete({ where: { userId } });

  // إزالة دور PROJECT_SUPERVISOR (المستخدم لم يعد مشرفاً)
  const newRoles = supervision.user.roles.filter((r) => r !== 'PROJECT_SUPERVISOR');
  await prisma.user.update({
    where: { id: userId },
    data: { roles: newRoles },
  });

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_UNASSIGNED', {
    userId,
    userName: `${supervision.user.firstName} ${supervision.user.lastName}`,
    projectId: supervision.operationalProjectId,
    projectName: supervision.operationalProject.name,
  });

  return { success: true };
}

/**
 * قائمة كل المشرفين (للمدير)
 */
async function listSupervisors() {
  return prisma.projectSupervisor.findMany({
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          mobileNumber: true, roles: true, isActive: true,
        },
      },
      operationalProject: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  // مشاريع
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,

  // مشرفون
  assignSupervisor,
  unassignSupervisor,
  listSupervisors,
};
