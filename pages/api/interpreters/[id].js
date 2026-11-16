// PUT    /api/interpreters/[id] — تعديل مترجم (المدير)
// DELETE /api/interpreters/[id] — حذفه من السجل (المدير) — لا يمسّ بيانات الدورات
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/interpreters/interpreters.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'PUT') return ok(res, await svc.update(req.query.id, req.body || {}, actor));
    return ok(res, await svc.remove(req.query.id, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['PUT', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
