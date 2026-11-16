// GET /api/courses/late-entries — طابور مبررات الإدخال المتأخر (المدير)
const { withMethods, withManager, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/courses/courses.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.listPendingLateEntries(req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
