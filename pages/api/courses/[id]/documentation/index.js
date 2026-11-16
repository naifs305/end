// GET /api/courses/[id]/documentation — توثيق الدورة (عنصر التميّز)
// PUT /api/courses/[id]/documentation — المقدمة والخاتمة وترتيب الصور والجلسات
const { withMethods, withAuth, ok, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  const actor = { user: req.user, activeRole: req.activeRole };
  try {
    if (req.method === 'PUT') return ok(res, await svc.updateContent(req.query.id, req.body || {}, actor));
    return ok(res, await svc.get(req.query.id, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
