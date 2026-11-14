// POST /api/field-reports/[id]/comments — تعليق زميل على التقرير الميداني
const { withMethods, withAuth, created, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/fieldReports/fieldReports.service');

async function handler(req, res) {
  try {
    const actor = { userId: req.user.id, activeRole: req.activeRole };
    return created(res, await svc.addComment(req.query.id, req.body?.content, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
