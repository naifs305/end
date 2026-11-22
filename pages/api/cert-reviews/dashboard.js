// GET /api/cert-reviews/dashboard — لوحة مراجعات الشهادات (المراجِعون، والوقت، والنتائج، والملاحظات)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/certReview/certReview.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.dashboard());
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
