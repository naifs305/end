const { withMethods, withAuth, withValidation, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/closure/closure.service');
const { updateStatusSchema } = require('../../../lib/modules/closure/closure.schema');

async function handler(req, res) {
  try {
    return await withValidation(updateStatusSchema, (r, s) =>
      svc.updateStatus(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
