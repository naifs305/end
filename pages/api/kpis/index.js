// GET /api/kpis
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  const { periodType, periodLabel } = req.query;
  const snapshots = await kpis.getSnapshots(periodType, periodLabel);
  return res.status(200).json(snapshots);
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
