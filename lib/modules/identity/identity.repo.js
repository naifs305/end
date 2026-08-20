// =============================================================
// طبقة الوصول للبيانات لوحدة الهوية (Repository)
// المكان الوحيد الذي يلمس prisma.user / prisma.projectSupervisor
// (وما يتعلق بالحذف التدريجي للمستخدم) ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

// قائمة الحقول العامة المعادة لبيانات المستخدم في مسارات users
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  mobileNumber: true,
  extensionNumber: true,
  roles: true,
  isActive: true,
  operationalProjectId: true,
  operationalProject: true,
  createdAt: true,
  updatedAt: true,
};

// قائمة حقول الملف الشخصي (تتضمن الصور)
const PROFILE_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  mobileNumber: true,
  extensionNumber: true,
  profileImage: true,
  signatureImage: true,
  roles: true,
  isActive: true,
  operationalProject: true,
  createdAt: true,
  updatedAt: true,
};

// -------- قراءات المستخدمين --------

function findByEmailInsensitive(email, { includeProject = false } = {}) {
  return prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    ...(includeProject ? { include: { operationalProject: true } } : {}),
  });
}

function findByIdWithProject(id) {
  return prisma.user.findUnique({ where: { id }, include: { operationalProject: true } });
}

function findFreshForRefresh(id) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, roles: true, isActive: true, firstName: true, lastName: true,
      tokenVersion: true, operationalProjectId: true, operationalProject: true,
    },
  });
}

function findByIdSelect(id, select = USER_SELECT) {
  return prisma.user.findUnique({ where: { id }, select });
}

function findByResetToken(token) {
  return prisma.user.findFirst({
    where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
  });
}

function findPasswordHash(id) {
  return prisma.user.findUnique({ where: { id }, select: { id: true, passwordHash: true } });
}

function countUsers(where) {
  return prisma.user.count({ where });
}

function findManyUsers(where, { skip, take } = {}) {
  return prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    skip,
    take,
  });
}

// -------- كتابات المستخدمين --------

function createUser(data) {
  return prisma.user.create({ data, include: { operationalProject: true } });
}

function updateUser(id, data, select = USER_SELECT) {
  return prisma.user.update({ where: { id }, data, select });
}

function updateUserRaw(id, data) {
  return prisma.user.update({ where: { id }, data });
}

function setResetToken(id, resetToken, resetTokenExpiry) {
  return prisma.user.update({ where: { id }, data: { resetToken, resetTokenExpiry } });
}

function resetPasswordByToken(id, passwordHash) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null, tokenVersion: { increment: 1 } },
  });
}

function setPasswordBumpVersion(id, passwordHash) {
  return prisma.user.update({ where: { id }, data: { passwordHash, tokenVersion: { increment: 1 } } });
}

// -------- حذف المستخدم (تدريجي) --------

function countCoursesForPrimary(id) {
  return prisma.course.count({ where: { primaryEmployeeId: id } });
}

function deactivateUser(id) {
  return prisma.user.update({ where: { id }, data: { isActive: false } });
}

// حذف تدريجي — كل جدول منفصل (كما في المسار الأصلي)
async function purgeUser(id) {
  try { await prisma.courseClosureTracking.updateMany({ where: { executedById: id }, data: { executedById: null } }); } catch {}
  try { await prisma.courseClosureTracking.updateMany({ where: { decidedById: id }, data: { decidedById: null } }); } catch {}
  try { await prisma.courseClosureTracking.updateMany({ where: { extensionGrantedById: id }, data: { extensionGrantedById: null } }); } catch {}
  try { await prisma.notification.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.auditLog.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.employeeKpiNote.deleteMany({ where: { OR: [{ userId: id }, { managerId: id }] } }); } catch {}
  try { await prisma.employeeKpiSnapshot.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.courseAssignmentRegister.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.courseSupport.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.messageRecipient.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.message.deleteMany({ where: { senderId: id } }); } catch {}
  try { await prisma.projectSupervisor.deleteMany({ where: { userId: id } }); } catch {}

  return prisma.user.delete({ where: { id } });
}

// -------- المشرفون (prisma.projectSupervisor) --------

function findProjectById(id) {
  return prisma.operationalProject.findUnique({ where: { id } });
}

function findSupervisorByUserId(userId, { include } = {}) {
  return prisma.projectSupervisor.findUnique({ where: { userId }, ...(include ? { include } : {}) });
}

function upsertSupervisor(userId, operationalProjectId, createdById) {
  return prisma.projectSupervisor.upsert({
    where: { userId },
    update: { operationalProjectId, createdById },
    create: { userId, operationalProjectId, createdById },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, roles: true, isActive: true } },
      operationalProject: true,
    },
  });
}

function deleteSupervisor(userId) {
  return prisma.projectSupervisor.delete({ where: { userId } });
}

function listSupervisors() {
  return prisma.projectSupervisor.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          roles: true, isActive: true, mobileNumber: true,
        },
      },
      operationalProject: true,
    },
  });
}

module.exports = {
  USER_SELECT,
  PROFILE_SELECT,
  findByEmailInsensitive,
  findByIdWithProject,
  findFreshForRefresh,
  findByIdSelect,
  findByResetToken,
  findPasswordHash,
  countUsers,
  findManyUsers,
  createUser,
  updateUser,
  updateUserRaw,
  setResetToken,
  resetPasswordByToken,
  setPasswordBumpVersion,
  countCoursesForPrimary,
  deactivateUser,
  purgeUser,
  findProjectById,
  findSupervisorByUserId,
  upsertSupervisor,
  deleteSupervisor,
  listSupervisors,
};
