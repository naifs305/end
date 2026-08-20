const { withManager, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const { userId } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    return ok(res, await identity.unassignSupervisor(userId, actor));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['DELETE'], withManager(handler));
module.exports.default = module.exports;
