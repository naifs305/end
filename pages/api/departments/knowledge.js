// GET /api/departments/knowledge?department=&country=&city=&q= — مساعد التنفيذ (لكل المستخدمين)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/departments/departments.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.knowledge(req.query || {}));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
