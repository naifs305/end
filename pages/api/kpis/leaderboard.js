// GET /api/kpis/leaderboard?periodLabel=2026-06
const { withManagerOrSupervisor, withMethods, ok } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { periodLabel } = req.query;
  const now   = new Date();
  const label = periodLabel || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  const data = await kpis.getProjectLeaderboard(label);
  return ok(res, data);
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
