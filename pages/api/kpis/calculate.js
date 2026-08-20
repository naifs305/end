// POST /api/kpis/calculate
const { withManager, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const { periodType, year, value } = req.body || {};
  if (!periodType || !year) {
    return res.status(400).json({ code: 'serverErrors.kpis.periodTypeAndYearRequired', message: 'نوع الفترة والسنة مطلوبان' });
  }

  try {
    const result = await kpis.calculateAndStore(
      periodType,
      Number(year),
      value ? Number(value) : undefined,
      req.user.id,
    );
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
