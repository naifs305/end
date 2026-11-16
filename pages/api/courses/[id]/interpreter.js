// GET  /api/courses/[id]/interpreter — بيانات مترجم الدورة
// PUT  /api/courses/[id]/interpreter — حفظها (إنشاء أو تعديل)
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/interpreter.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const result = await svc.getInterpreter(req.query.id, req.user, req.activeRole);
      return ok(res, result);
    }

    const saved = await svc.saveInterpreter(req.query.id, req.body || {}, req.user, req.activeRole);
    return ok(res, saved);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
