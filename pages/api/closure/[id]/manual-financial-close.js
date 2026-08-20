const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const { manualFinancialCloseSchema } = require('../../../../lib/modules/closure/closure.schema');

async function handler(req, res) {
  try {
    return await withValidation(manualFinancialCloseSchema, (r, s) =>
      svc.approveFinancialElementDirectly(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
