const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const analytics = require('../../../lib/services/analytics');

async function handler(req, res) {
  try {
    const data = await analytics.getEmployeeDashboard(req.user.id);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
