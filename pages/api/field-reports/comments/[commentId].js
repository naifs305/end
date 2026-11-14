// DELETE /api/field-reports/comments/[commentId] — يحذفه كاتبه أو المدير
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/fieldReports/fieldReports.service');

async function handler(req, res) {
  try {
    const actor = { userId: req.user.id, activeRole: req.activeRole };
    return ok(res, await svc.removeComment(req.query.commentId, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['DELETE'], withAuth(handler));
module.exports.default = module.exports;
