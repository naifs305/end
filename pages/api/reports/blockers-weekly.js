// GET /api/reports/blockers-weekly — القائمة الأسبوعية للجهات المتأخرة
const { withMethods, withManagerOrSupervisor, ok, fail } = require('../../../lib/server/http');
const reports = require('../../../lib/modules/blockers/blockers.reports');

async function handler(req, res) {
  try {
    return ok(res, await reports.buildWeeklyList(new Date()));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
