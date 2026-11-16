// =============================================================
// طبقة الوصول للتقارير الميدانية وتعليقاتها
// =============================================================
const prisma = require('../../db/prisma');

const AUTHOR = { select: { id: true, firstName: true, lastName: true, profileImage: true } };
const COURSE = { select: { id: true, name: true, city: true, startDate: true, endDate: true } };

function findAll() {
  return prisma.fieldReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: AUTHOR, course: COURSE, _count: { select: { comments: true } } },
  });
}

function findById(id) {
  return prisma.fieldReport.findUnique({
    where: { id },
    include: {
      author: AUTHOR,
      course: COURSE,
      comments: { orderBy: { createdAt: 'asc' }, include: { author: AUTHOR } },
    },
  });
}

function findRecent(since, excludeAuthorId) {
  return prisma.fieldReport.findMany({
    where: { createdAt: { gte: since }, ...(excludeAuthorId ? { NOT: { authorId: excludeAuthorId } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      author: { select: { firstName: true, lastName: true } },
      course: { select: { name: true } },
      _count: { select: { comments: true } },
    },
  });
}

function findReportOwner(id) {
  return prisma.fieldReport.findUnique({
    where: { id },
    select: { id: true, authorId: true, course: { select: { name: true } } },
  });
}

function createComment(reportId, authorId, content) {
  return prisma.fieldReportComment.create({
    data: { reportId, authorId, content },
    include: { author: AUTHOR },
  });
}

function findComment(id) {
  return prisma.fieldReportComment.findUnique({ where: { id }, select: { id: true, authorId: true } });
}

function deleteComment(id) {
  return prisma.fieldReportComment.delete({ where: { id } });
}

module.exports = { findAll, findById, findRecent, findReportOwner, createComment, findComment, deleteComment };
