// GET /api/kpis/leaderboard?periodLabel=2026-06
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  const { periodLabel } = req.query;
  const now   = new Date();
  const label = periodLabel || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const data = await kpis.getProjectLeaderboard(label);
  return res.status(200).json(data);
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
