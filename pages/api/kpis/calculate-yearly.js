// POST /api/kpis/calculate-yearly  { year }
const { withManager, withMethods, ok, fail } = require('../../../lib/server/http');
const kpis = require('../../../lib/modules/kpi/kpi.service');

async function handler(req, res) {
  const year = Number(req.body?.year || new Date().getFullYear());
  if (!year || year < 2024 || year > 2030) {
    return res.status(400).json({ code: 'serverErrors.kpis.invalidYear', message: 'السنة غير صحيحة' });
  }
  try {
    const result = await kpis.calculateYearlyAndStore(year, req.user.id);
    return ok(res, result);
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
