// GET /api/kpis/[userId]/[periodType]/[periodLabel]
const { withManager, withMethods } = require('../../../../../lib/middleware/auth');
const kpis = require('../../../../../lib/services/kpis');

async function handler(req, res) {
  const { userId, periodType, periodLabel } = req.query;
  try {
    const data = await kpis.getEmployeeSnapshotDetails(userId, periodType, periodLabel);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
