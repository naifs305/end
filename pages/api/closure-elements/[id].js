const { withMethods, withManager, withValidation, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/closure/closure.service');
const { updateElementSchema } = require('../../../lib/modules/closure/closure.schema');

async function handler(req, res) {
  try {
    return await withValidation(updateElementSchema, (r, s) =>
      svc.updateElement(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PATCH'], withManager(handler));
module.exports.default = module.exports;
