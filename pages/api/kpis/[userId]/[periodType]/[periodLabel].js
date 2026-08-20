// GET /api/kpis/[userId]/[periodType]/[periodLabel]
// مدير/مشرف: أي موظف — موظف: نفسه فقط
const { withAuth, withMethods, ok, fail } = require('../../../../../lib/server/http');
const kpis = require('../../../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { userId, periodType, periodLabel } = req.query;

  // الموظف لا يرى بيانات غيره
  if (req.activeRole === 'EMPLOYEE' && req.user.id !== userId) {
    return res.status(403).json({ code: 'serverErrors.common.forbidden', message: 'غير مصرح' });
  }

  try {
    const data = await kpis.getEmployeeSnapshotDetails(userId, periodType, periodLabel, {
      activeRole: req.activeRole,
      userId: req.user.id,
      supervisedProjectIds: req.scope?.supervisedProjectIds || [],
    });
    return ok(res, data);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
