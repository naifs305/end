// =============================================================
// وحدة التقارير — حالات الاستخدام (Service)
// تجميع تقارير الإقفال + الملاحظات الميدانية حسب دور المستخدم.
// المنطق منقول حرفياً من lib/services/reports.js مع نقل استدعاءات
// prisma إلى المستودع وإضافة حارس الصلاحيات عبر policy.
// =============================================================
const repo = require('./reports.repo');
const policy = require('./reports.policy');

const REPORT_KEYS = ['opening_report', 'closing_report', 'report'];
const VISIBLE_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'RETURNED', 'REJECTED'];

function reportTypeLabel(key) {
  if (key === 'opening_report') return 'تقرير افتتاح الدورة';
  return 'تقرير اختتام الدورة';
}

async function listReports(user, activeRole) {
  policy.assertCanListReports(activeRole);

  const inactiveUsers = await repo.findInactiveUserIds();
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

  // QUALITY_VIEWER: قارئ على مستوى المنظمة (قراءة فقط) — يرى نفس مجموعة المدير.
  // فرع صريح مقصود حتى لا يكون توسيع الصلاحية بالخطأ عبر السقوط لفرع المدير.
  if (activeRole === 'QUALITY_VIEWER') {
    // لا قيود إضافية على where — مجموعة قراءة على مستوى المنظمة (مطابقة للمدير)
  }

  const rows = await repo.findClosureReportRows(where);

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

  // QUALITY_VIEWER: قارئ على مستوى المنظمة (قراءة فقط) — يرى نفس مجموعة المدير.
  // فرع صريح مقصود حتى لا يكون توسيع الصلاحية بالخطأ عبر السقوط لفرع المدير.
  if (activeRole === 'QUALITY_VIEWER') {
    // لا قيود إضافية على fieldWhere — أرشيف على مستوى المنظمة (مطابق للمدير)
  }

  const fieldRows = await repo.findFieldReportRows(fieldWhere);

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

// قراءة تقرير ملاحظات ميداني للتصدير (HTML / EML)
async function getFieldReportForExport(id) {
  return repo.findFieldReportForExport(id);
}

module.exports = { listReports, getFieldReportForExport };
