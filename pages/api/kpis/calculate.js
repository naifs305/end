// POST /api/kpis/calculate
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  const { periodType, year, value } = req.body || {};
  if (!periodType || !year) {
    return res.status(400).json({ message: 'نوع الفترة والسنة مطلوبان' });
  }

  try {
    const result = await kpis.calculateAndStore(
      periodType,
      Number(year),
      value ? Number(value) : undefined,
      req.user.id,
    );
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
