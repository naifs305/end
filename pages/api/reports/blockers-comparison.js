// GET /api/reports/blockers-comparison?from=&to= — المقارنة والفحص المتقاطع
const { withMethods, withManager, ok, fail } = require('../../../lib/server/http');
const reports = require('../../../lib/modules/blockers/blockers.reports');

function parseDate(value, fallback) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d : fallback;
}

async function handler(req, res) {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const from = parseDate(req.query.from, defaultFrom);
    const to = parseDate(req.query.to, now);
    return ok(res, await reports.buildComparisonReport(from, to));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
