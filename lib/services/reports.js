const prisma = require('../db/prisma');

const REPORT_KEYS = ['opening_report', 'closing_report', 'report'];
const VISIBLE_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'RETURNED', 'REJECTED'];

function reportTypeLabel(key) {
  if (key === 'opening_report') return 'تقرير افتتاح الدورة';
  return 'تقرير اختتام الدورة';
}

async function listReports(user, activeRole) {
  const inactiveUsers = await prisma.user.findMany({
    where: { isActive: false },
    select: { id: true },
  });
  const excludedUserIds = inactiveUsers.map((item) => item.id);

  const baseWhere = {
    element: { key: { in: REPORT_KEYS } },
    status: { in: VISIBLE_STATUSES },
    ...(excludedUserIds.length ? { NOT: { executedById: { in: excludedUserIds } } } : {}),
  };

  const where = { ...baseWhere };

  if (activeRole === 'EMPLOYEE') {
    where.executedById = user.id;
  }

  if (activeRole === 'PROJECT_SUPERVISOR') {
    where.course = {
      operationalProject: {
        supervisors: {
          some: { userId: user.id },
        },
      },
    };
  }

  const rows = await prisma.courseClosureTracking.findMany({
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

  const closureReports = rows.map((item) => ({
    id: item.id,
    courseId: item.courseId,
    courseName: item.course?.name || '-',
    startDate: item.course?.startDate || null,
    endDate: item.course?.endDate || null,
    locationType: item.course?.locationType || '-',
    presenterName: `${item.course?.primaryEmployee?.firstName || ''} ${item.course?.primaryEmployee?.lastName || ''}`.trim() || '-',
    executionAt: item.executionAt || null,
    status: item.status,
    reportType: reportTypeLabel(item.element?.key),
    reportKey: item.element?.key,
  }));

  // ── تقارير الملاحظات الميدانية (أرشيف مفتوح لكل المستخدمين) ──
  const fieldWhere = {
    ...(excludedUserIds.length ? { NOT: { authorId: { in: excludedUserIds } } } : {}),
  };

  if (activeRole === 'EMPLOYEE') {
    fieldWhere.authorId = user.id;
  }

  if (activeRole === 'PROJECT_SUPERVISOR') {
    fieldWhere.OR = [
      { authorId: user.id },
      { course: { operationalProject: { supervisors: { some: { userId: user.id } } } } },
    ];
  }

  const fieldRows = await prisma.fieldReport.findMany({
    where: fieldWhere,
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

  const fieldReports = fieldRows.map((item) => ({
    id: item.id,
    courseId: item.courseId,
    courseName: item.course?.name || '-',
    startDate: item.course?.startDate || null,
    endDate: item.course?.endDate || null,
    locationType: item.course?.locationType || '-',
    presenterName: `${item.author?.firstName || ''} ${item.author?.lastName || ''}`.trim() || '-',
    executionAt: item.createdAt || null,
    status: 'ARCHIVED',
    reportType: 'تقرير ملاحظات عامة',
    reportKey: 'notes_report',
  }));

  return [...closureReports, ...fieldReports].sort((a, b) => new Date(b.executionAt) - new Date(a.executionAt));
}

module.exports = { listReports };
