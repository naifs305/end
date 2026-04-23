const prisma = require('../db/prisma');

const REPORT_KEYS = ['opening_report', 'closing_report', 'report'];
const VISIBLE_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'RETURNED', 'REJECTED'];

function reportTypeLabel(key) {
  if (key === 'opening_report') return 'تقرير افتتاح الدورة';
  return 'تقرير اختتام الدورة';
}

async function listReports(user, activeRole) {
  const baseWhere = {
    element: {
      is: { key: { in: REPORT_KEYS } },
    },
    status: { in: VISIBLE_STATUSES },
  };

  const where = { ...baseWhere };

  if (activeRole === 'EMPLOYEE') {
    where.executedById = user.id;
  }

  if (activeRole === 'PROJECT_SUPERVISOR') {
    where.course = {
      is: {
        operationalProject: {
          supervisors: {
            some: { userId: user.id },
          },
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
      executedBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { executionAt: 'desc' },
  });

  return rows.map((item) => ({
    id: item.id,
    courseId: item.courseId,
    courseName: item.course?.name || '-',
    startDate: item.course?.startDate || null,
    endDate: item.course?.endDate || null,
    locationType: item.course?.locationType || '-',
    presenterName:
      `${item.executedBy?.firstName || ''} ${item.executedBy?.lastName || ''}`.trim()
      || item.executedBy?.email
      || `${item.course?.primaryEmployee?.firstName || ''} ${item.course?.primaryEmployee?.lastName || ''}`.trim()
      || '-',
    executionAt: item.executionAt || null,
    status: item.status,
    reportType: reportTypeLabel(item.element?.key),
    reportKey: item.element?.key,
  }));
}

module.exports = { listReports };
