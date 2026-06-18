const { withManagerOrSupervisor, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  try {
    const data = await kpis.getManagerDashboard(req.user, req.activeRole, req.query.projectId);
    return ok(res, data);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
