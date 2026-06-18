// =============================================================
// طبقة الوصول للبيانات لوحدة المشاريع (Repository)
// المكان الوحيد الذي يلمس prisma.operationalProject ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

const PROJECT_INCLUDE = {
  supervisors: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
    },
  },
  _count: { select: { users: true, courses: true } },
};

function findAll() {
  return prisma.operationalProject.findMany({ orderBy: { name: 'asc' }, include: PROJECT_INCLUDE });
}

// قائمة مختصرة (عامة) — تُستخدم في صفحة التسجيل
function findAllMinimal() {
  return prisma.operationalProject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

function findById(id) {
  return prisma.operationalProject.findUnique({ where: { id }, include: PROJECT_INCLUDE });
}

function findWithRelationCounts(id) {
  return prisma.operationalProject.findUnique({
    where: { id },
    include: { _count: { select: { users: true, courses: true, supervisors: true } } },
  });
}

function create(name) {
  return prisma.operationalProject.create({ data: { name } });
}

function update(id, name) {
  return prisma.operationalProject.update({ where: { id }, data: { name } });
}

function remove(id) {
  return prisma.operationalProject.delete({ where: { id } });
}

module.exports = { findAll, findAllMinimal, findById, findWithRelationCounts, create, update, remove };
