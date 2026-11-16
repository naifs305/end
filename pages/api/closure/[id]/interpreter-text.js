// POST /api/closure/[id]/interpreter-text
// حفظ النص الذي عدّله المنسق في مستند المترجم قبل تصديره
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.saveInterpreterDocumentText(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
