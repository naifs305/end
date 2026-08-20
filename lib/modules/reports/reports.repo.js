// =============================================================
// طبقة الوصول للبيانات لوحدة التقارير (Repository)
// =============================================================
const prisma = require('../../db/prisma');

function findInactiveUserIds() {
  return prisma.user.findMany({ where: { isActive: false }, select: { id: true } });
}

function findClosureReportRows(where) {
  return prisma.courseClosureTracking.findMany({
    where,
    include: {
      element: true,
      course: {
        include: {
          operationalProject: true,
          primaryEmployee: true,
        },
      },
    },
    orderBy: { executionAt: 'desc' },
  });
}

function findFieldReportRows(where) {
  return prisma.fieldReport.findMany({
    where,
    select: {
      id: true,
      courseId: true,
      authorId: true,
      createdAt: true,
      author: { select: { firstName: true, lastName: true } },
      course: { select: { name: true, startDate: true, endDate: true, locationType: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function findFieldReportForExport(id) {
  return prisma.fieldReport.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
    },
  });
}

module.exports = { findInactiveUserIds, findClosureReportRows, findFieldReportRows, findFieldReportForExport };
