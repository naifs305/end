// GET /api/field-reports/insights?kind=&section=&q= — ملاحظات ميدانية من تقارير الدورات (لكل المستخدمين)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const insights = require('../../../lib/modules/fieldReports/fieldReports.insights');

async function handler(req, res) {
  try {
    return ok(res, await insights.list(req.query));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
