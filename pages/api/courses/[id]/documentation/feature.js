// POST /api/courses/[id]/documentation/feature — «إصدار مميّز» يمنحه المدير { featured: true|false }
const { withMethods, withAuth, ok, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.setFeatured(req.query.id, !!req.body?.featured, { user: req.user, activeRole: req.activeRole }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
