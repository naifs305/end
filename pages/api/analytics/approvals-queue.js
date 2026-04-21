// GET /api/analytics/approvals-queue
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const analytics = require('../../../lib/services/analytics');

async function handler(req, res) {
  const data = await analytics.getPendingApprovalsQueue(req.user, req.activeRole);
  return res.status(200).json(data);
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
