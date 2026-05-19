// GET /api/kpis/trend/[userId]?periodType=MONTHLY&periodsCount=6
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const kpis = require('../../../../lib/services/kpis');

async function handler(req, res) {
  const { userId } = req.query;
  const { periodType, periodsCount } = req.query;

  try {
    const data = await kpis.getPerformanceTrend(userId, periodType, periodsCount, {
      activeRole: req.activeRole,
      userId: req.user.id,
      supervisedProjectIds: req.scope?.supervisedProjectIds || [],
    });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
