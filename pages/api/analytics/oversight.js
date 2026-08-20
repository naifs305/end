// GET /api/analytics/oversight
// لوحة مراقبة المدير — جميع الموظفين مع حالة دوراتهم وعناصر الإقفال
const prisma   = require('../../../lib/db/prisma');
const { withManagerOrSupervisor, withMethods, ok } = require('../../../lib/server/http');
const { getSupervisedProjectIds } = require('../../../lib/services/permissions');

async function handler(req, res) {
  const { user, activeRole } = req;

  // نطاق المشاريع المرئية
  let projectWhere = {};
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const ids = await getSupervisedProjectIds(user.id);
    projectWhere = { id: { in: ids } };
  }

  // جلب الموظفين مع دوراتهم وعناصرها
  const employees = await prisma.user.findMany({
    where: {
      isActive: true,
      roles: { has: 'EMPLOYEE' },
      operationalProject: Object.keys(projectWhere).length ? projectWhere : undefined,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      operationalProject: { select: { id: true, name: true } },
      primaryCourses: {
        where: { status: { notIn: ['ARCHIVED'] } },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          startDate: true,
          endDate: true,
          closureElements: {
            select: { status: true, executionAt: true, element: { select: { key: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [
      { operationalProjectId: 'asc' },
      { firstName: 'asc' },
    ],
  });

  // تحويل البيانات + حساب الإحصائيات
  const result = employees
    .filter(emp => emp.primaryCourses.length > 0)
    .map(emp => {
      const courses = emp.primaryCourses.map(course => {
        const elements = course.closureElements.filter(e => e.status !== 'NOT_APPLICABLE');
        const total      = elements.length;
        const approved   = elements.filter(e => e.status === 'APPROVED').length;
        const pending    = elements.filter(e => e.status === 'PENDING_APPROVAL').length;
        const returned   = elements.filter(e => e.status === 'RETURNED').length;
        const notStarted = elements.filter(e => e.status === 'NOT_STARTED').length;
        const submitted  = approved + pending + returned; // كل ما قدّمه الموظف
        const pct        = total > 0 ? Math.round((approved / total) * 100) : 0;

        // هل الدورة متأخرة؟
        const isOverdue = course.endDate
          && new Date(course.endDate) < new Date()
          && !['CLOSED', 'ARCHIVED'].includes(course.status);

        return {
          id: course.id, name: course.name, code: course.code,
          status: course.status, startDate: course.startDate, endDate: course.endDate,
          elements: { total, approved, pending, returned, notStarted, submitted },
          completionPct: pct,
          isOverdue,
        };
      });

      // ملخص الموظف
      const totalEl    = courses.reduce((s, c) => s + c.elements.total, 0);
      const approvedEl = courses.reduce((s, c) => s + c.elements.approved, 0);
      const pendingEl  = courses.reduce((s, c) => s + c.elements.pending, 0);
      const returnedEl = courses.reduce((s, c) => s + c.elements.returned, 0);
      const overdueCourses = courses.filter(c => c.isOverdue).length;
      const completionPct  = totalEl > 0 ? Math.round((approvedEl / totalEl) * 100) : 0;

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        projectName: emp.operationalProject?.name || '-',
        projectId:   emp.operationalProject?.id   || null,
        courses,
        summary: {
          totalCourses: courses.length,
          overdueCourses,
          totalElements:    totalEl,
          approvedElements: approvedEl,
          pendingElements:  pendingEl,
          returnedElements: returnedEl,
          completionPct,
        },
      };
    })
    .sort((a, b) => {
      // الأكثر مشاكل أولاً (دورات متأخرة + عناصر معلقة)
      const scoreA = a.summary.overdueCourses * 10 + a.summary.pendingElements + a.summary.returnedElements;
      const scoreB = b.summary.overdueCourses * 10 + b.summary.pendingElements + b.summary.returnedElements;
      return scoreB - scoreA;
    });

  return ok(res, { employees: result });
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
