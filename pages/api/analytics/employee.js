// GET /api/analytics/employee
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const analytics = require('../../../lib/services/analytics');

async function handler(req, res) {
  const data = await analytics.getEmployeeDashboard(req.user.id);
  return res.status(200).json(data);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
