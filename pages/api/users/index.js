const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    return ok(res, await identity.listUsers(actor, { page: req.query.page, limit: req.query.limit }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
