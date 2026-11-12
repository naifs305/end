// POST /api/closure-elements/suspensions/[id]/close — إغلاق فترة الإيقاف
const { withMethods, withManager, ok, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/closure/suspensions.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.closeSuspension(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
