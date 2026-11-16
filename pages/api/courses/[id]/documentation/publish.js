// POST /api/courses/[id]/documentation/publish — { publish: true | false }
// النشر بمعايير الجودة يمنح نجمة التميّز تلقائياً، وإلغاؤه يُسقطها
const { withMethods, withAuth, ok, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  const actor = { user: req.user, activeRole: req.activeRole };
  try {
    const out = req.body?.publish === false
      ? await svc.unpublish(req.query.id, actor)
      : await svc.publish(req.query.id, actor);
    return ok(res, out);
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
