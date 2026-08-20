const { withAuth, withMethods, ok } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const data = await kpis.getEmployeeDashboard(req.user);
  return ok(res, data);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
