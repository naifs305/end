// POST /api/courses/[id]/documentation/media — رفع صورة (مضغوطة في المتصفح)
const { withMethods, withAuth, created, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  try {
    return created(res, await svc.addMedia(req.query.id, req.body || {}, { user: req.user, activeRole: req.activeRole }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { bodyParser: { sizeLimit: '8mb' } } };
