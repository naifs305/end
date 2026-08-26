const { withAuth, withMethods, withValidation, ok, created, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');
const { createDirectoryUserSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };

  if (req.method === 'POST') {
    return withValidation(createDirectoryUserSchema, async (r, s) => {
      try {
        return created(s, await identity.createDirectoryUser(r.valid, actor));
      } catch (e) {
        return fail(s, e);
      }
    })(req, res);
  }

  try {
    return ok(res, await identity.listUsers(actor, { page: req.query.page, limit: req.query.limit }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
