// GET /api/documentation/library?featured=1&q= — مكتبة الإصدارات (لكل المستخدمين)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  try {
    return ok(res, { items: await svc.library({ featuredOnly: req.query.featured === '1', q: req.query.q || '' }), canFeature: req.activeRole === 'MANAGER' });
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
