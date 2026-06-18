// =============================================================
// GET /api/users/me
// -------------------------------------------------------------
// يرجع بيانات المستخدم الحالي (يستدعيه سياق المصادقة في الواجهة)
// =============================================================

const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    return ok(res, await identity.getMe(actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
