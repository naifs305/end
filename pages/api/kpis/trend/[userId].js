// GET /api/kpis/trend/[userId]?periodType=MONTHLY&periodsCount=6
const { withAuth, withMethods, ok, fail } = require('../../../../lib/server/http');
const kpis = require('../../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { userId } = req.query;
  const { periodType, periodsCount } = req.query;

  try {
    const data = await kpis.getPerformanceTrend(userId, periodType, periodsCount, {
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
