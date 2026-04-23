// GET /api/kpis
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  const { periodType, periodLabel } = req.query;
  const snapshots = await kpis.getSnapshots(periodType, periodLabel, {
    activeRole: req.activeRole,
    userId: req.user.id,
    supervisedProjectIds: req.scope?.supervisedProjectIds || [],
  });
  return res.status(200).json(snapshots);
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
