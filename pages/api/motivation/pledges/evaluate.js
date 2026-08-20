// PUT /api/motivation/pledges/evaluate — تقييم التعهد (مدير)
const { withAuth, withMethods, ok, fail } = require('../../../../lib/server/http');
const motivationService = require('../../../../lib/modules/motivation/motivation.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    return ok(res, await motivationService.evaluatePledge(req.body || {}, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
