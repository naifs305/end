// GET /api/departments/performance?period=month|quarter|year|all — لوحة أداء الإدارات
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/departments/departments.service');

async function handler(req, res) {
  try {
    const period = ['month', 'quarter', 'year', 'all'].includes(req.query.period) ? req.query.period : 'year';
    return ok(res, await svc.dashboard(period, { user: req.user, activeRole: req.activeRole }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
