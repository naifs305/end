const prisma = require('../db/prisma');
const { logAudit } = require('./audit');

async function listProjects() {
  return prisma.operationalProject.findMany({
    orderBy: { name: 'asc' },
    include: {
      supervisors: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, isActive: true },
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
          user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
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

  const project = await prisma.operationalProject.create({
    data: { name: name.trim() },
  });

  await logAudit(managerId, 'MANAGER', 'PROJECT_CREATED', {
    projectId: project.id,
    projectName: project.name,
  });

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

  await logAudit(managerId, 'MANAGER', 'PROJECT_UPDATED', {
    projectId: project.id,
    projectName: project.name,
  });

  return project;
}

async function deleteProject(id, managerId) {
  const project = await prisma.operationalProject.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          users: true,
          courses: true,
          supervisors: true,
        },
      },
    },
  });

  if (!project) {
    const err = new Error('المشروع غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (project._count.users > 0 || project._count.courses > 0 || project._count.supervisors > 0) {
    const err = new Error('لا يمكن حذف مشروع مرتبط بمستخدمين أو دورات أو إشراف');
    err.statusCode = 400;
    throw err;
  }

  await prisma.operationalProject.delete({ where: { id } });

  await logAudit(managerId, 'MANAGER', 'PROJECT_DELETED', {
    projectId: project.id,
    projectName: project.name,
  });

  return { success: true };
}

async function assignSupervisor(userId, operationalProjectId, managerId) {
  const [user, project] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.operationalProject.findUnique({ where: { id: operationalProjectId } }),
  ]);

  if (!user) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (!project) {
    const err = new Error('المشروع غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const existing = await prisma.projectSupervisor.findUnique({ where: { userId } });
  if (existing && existing.operationalProjectId !== operationalProjectId) {
    const err = new Error('المستخدم مشرف بالفعل على مشروع آخر');
    err.statusCode = 400;
    throw err;
  }

  const assignment = await prisma.projectSupervisor.upsert({
    where: { userId },
    update: {
      operationalProjectId,
      createdById: managerId,
    },
    create: {
      userId,
      operationalProjectId,
      createdById: managerId,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, roles: true, isActive: true },
      },
      operationalProject: true,
    },
  });

  if (!user.roles.includes('PROJECT_SUPERVISOR')) {
    await prisma.user.update({
      where: { id: userId },
      data: { roles: { push: 'PROJECT_SUPERVISOR' } },
    });
  }

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_ASSIGNED', {
    userId,
    operationalProjectId,
    projectName: project.name,
  });

  return assignment;
}

async function unassignSupervisor(userId, managerId) {
  const supervision = await prisma.projectSupervisor.findUnique({
    where: { userId },
    include: {
      user: true,
      operationalProject: true,
    },
  });

  if (!supervision) {
    const err = new Error('المستخدم ليس مشرف مشروع');
    err.statusCode = 404;
    throw err;
  }

  await prisma.projectSupervisor.delete({ where: { userId } });

  const nextRoles = (supervision.user.roles || []).filter((role) => role !== 'PROJECT_SUPERVISOR');
  await prisma.user.update({
    where: { id: userId },
    data: { roles: nextRoles },
  });

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_UNASSIGNED', {
    userId,
    operationalProjectId: supervision.operationalProjectId,
    projectName: supervision.operationalProject.name,
  });

  return { success: true };
}

async function listSupervisors() {
  return prisma.projectSupervisor.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          roles: true,
          isActive: true,
          mobileNumber: true,
        },
      },
      operationalProject: true,
    },
  });
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignSupervisor,
  unassignSupervisor,
  listSupervisors,
};
