// GET /api/cert-reviews/mine — شهادات تنتظر مراجعتي
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/certReview/certReview.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.mine(req.user));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
