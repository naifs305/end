const { withAuth, withMethods, ok, fail } = require('../../../../lib/server/http');
const identity = require('../../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const { id } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    return ok(res, await identity.adminResetPassword(id, req.body || {}, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
