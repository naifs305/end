const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/reports/reports.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.listReports(req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
