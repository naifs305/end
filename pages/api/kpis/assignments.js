// GET/POST /api/kpis/assignments
const { withManagerOrSupervisor, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { periodType, year, value } = req.query;
      if (!periodType || !year) {
        return res.status(400).json({ code: 'serverErrors.kpis.periodTypeAndYearParamsRequired', message: 'periodType و year مطلوبان' });
      }
      const data = await kpis.getAssignmentRegister(
        periodType,
        Number(year),
        value ? Number(value) : undefined,
        {
          activeRole: req.activeRole,
          userId: req.user.id,
          supervisedProjectIds: req.scope?.supervisedProjectIds || [],
        },
      );
      return ok(res, data);
    }

    if (req.method === 'POST') {
      if (req.activeRole !== 'MANAGER') {
        return res.status(403).json({ code: 'serverErrors.kpis.managerRequiredToEdit', message: 'يتطلب صلاحية المدير للتعديل' });
      }

      const { userId, periodType, year, value, assignedCoursesCount, notes } = req.body || {};
      if (!userId || !periodType || !year) {
        return res.status(400).json({ code: 'serverErrors.kpis.assignmentDataIncomplete', message: 'بيانات الإسناد غير مكتملة' });
      }
      const saved = await kpis.upsertAssignmentRegister(
        req.user.id,
        userId,
        periodType,
        Number(year),
        value ? Number(value) : undefined,
        Number(assignedCoursesCount),
        notes,
      );
      return ok(res, saved);
    }
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET', 'POST'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
