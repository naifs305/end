// =============================================================
// طبقة الوصول لسجل المترجمين — المكان الوحيد الذي يلمس
// prisma.interpreter ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

const WITH_COUNT = { _count: { select: { courses: true } } };

function findAll(search) {
  const q = String(search || '').trim();
  const where = q
    ? {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { nationalId: { contains: q } },
          { mobile: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      }
    : undefined;
  return prisma.interpreter.findMany({ where, orderBy: { fullName: 'asc' }, include: WITH_COUNT });
}

function findById(id) {
  return prisma.interpreter.findUnique({ where: { id }, include: WITH_COUNT });
}

function findByNationalId(nationalId) {
  return prisma.interpreter.findUnique({ where: { nationalId } });
}

function create(data, createdById) {
  return prisma.interpreter.create({ data: { ...data, createdById: createdById || null } });
}

function update(id, data) {
  return prisma.interpreter.update({ where: { id }, data });
}

function remove(id) {
  return prisma.interpreter.delete({ where: { id } });
}

module.exports = { findAll, findById, findByNationalId, create, update, remove };
