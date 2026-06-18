// POST /api/closure/[id]/closing-report
const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');
const { reportSchema } = require('../../../../lib/modules/closure/closure.schema');

async function handler(req, res) {
  try {
    return await withValidation(reportSchema, (r, s) =>
      svc.submitClosingReport(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
    responseLimit: '12mb',
  },
};
