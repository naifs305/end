// GET /api/blockers/quota — رصيد المنسق الفصلي من البلاغات
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/blockers/blockers.service');

async function handler(req, res) {
  try {
    const userId = req.activeRole === 'MANAGER' && req.query.userId ? req.query.userId : req.user.id;
    return ok(res, await svc.getQuotaStatus(userId));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
