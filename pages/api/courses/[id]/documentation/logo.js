// POST /api/courses/[id]/documentation/logo — رفع شعار شريك (PNG شفاف) { image }
const { withMethods, withAuth, created, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  try {
    return created(res, await svc.addLogo(req.query.id, req.body || {}, { user: req.user, activeRole: req.activeRole }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { bodyParser: { sizeLimit: '2mb' } } };
