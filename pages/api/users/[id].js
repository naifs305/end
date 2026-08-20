const { withAuth, withMethods, withValidation, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');
const { userUpdateSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  const { id } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };

  try {
    if (req.method === 'GET') {
      return ok(res, await identity.getUser(id, actor));
    }
    return await withValidation(userUpdateSchema, (r, s) =>
      identity.updateUser(id, r.valid, actor).then((u) => ok(s, u)))(req, res);
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
