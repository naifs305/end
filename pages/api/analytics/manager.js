// GET /api/analytics/manager
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const analytics = require('../../../lib/services/analytics');

async function handler(req, res) {
  const { projectId } = req.query;
  const data = await analytics.getManagerDashboard(req.user, req.activeRole, projectId);
  return res.status(200).json(data);
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
