// GET /api/field-reports/[id] — التقرير الميداني بتفاصيله وتعليقاته (لكل المستخدمين)
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/fieldReports/fieldReports.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.get(req.query.id));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
