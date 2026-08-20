// GET /api/auth/refresh — يُصدر token جديداً بالأدوار الحالية من قاعدة البيانات
const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  try {
    return ok(res, await identity.refresh(req.user.id));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
