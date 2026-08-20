// GET /api/kpis — مدير: كل الفريق / مشرف: فريقه / موظف: نفسه فقط
const { withAuth, withMethods, ok } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { periodType, periodLabel } = req.query;
  const snapshots = await kpis.getSnapshots(periodType, periodLabel, {
    activeRole: req.activeRole,
    userId:     req.user.id,
    supervisedProjectIds: req.scope?.supervisedProjectIds || [],
  });
  return ok(res, snapshots);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
