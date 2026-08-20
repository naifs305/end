// POST /api/closure/[id]/draft
// حفظ مسودة لتقرير الافتتاح/الاختتام دون تقديمه للاعتماد
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/closure/closure.service');

async function handler(req, res) {
  const { id } = req.query;
  try {
    return ok(res, await svc.saveReportDraft(id, req.body || {}, req.user, req.activeRole));
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
