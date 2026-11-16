// GET  /api/closure-elements/suspensions — فترات إيقاف العناصر
// POST /api/closure-elements/suspensions — فتح فترة إيقاف (المدير)
const { withMethods, withManager, ok, created, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/suspensions.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return ok(res, await svc.listSuspensions(req.query.elementId));
    }
    const result = await svc.createSuspension(req.body || {}, req.user, req.activeRole);
    return created(res, result);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'POST'], withManager(handler));
module.exports.default = module.exports;
