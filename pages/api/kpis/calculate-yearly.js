// POST /api/kpis/calculate-yearly  { year }
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  const year = Number(req.body?.year || new Date().getFullYear());
  if (!year || year < 2024 || year > 2030) {
    return res.status(400).json({ message: 'السنة غير صحيحة' });
  }
  try {
    const result = await kpis.calculateYearlyAndStore(year, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
