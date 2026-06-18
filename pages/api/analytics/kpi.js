const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  try {
    const data = await kpis.getEmployeeKPI(req.user.id);
    return ok(res, data);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
