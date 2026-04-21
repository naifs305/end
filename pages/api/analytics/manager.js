const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const analytics = require('../../../lib/services/analytics');

async function handler(req, res) {
  try {
    const data = await analytics.getManagerDashboard(req.user, req.activeRole, req.query.projectId);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
