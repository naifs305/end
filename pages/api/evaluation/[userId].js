// GET /api/evaluation/:userId?year=2026 — ملف تقييم موظف للطباعة (المدير وصاحبه)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/points/points.service');

async function handler(req, res) {
  try {
    const id = req.query.userId === 'me' ? req.user.id : String(req.query.userId);
    return ok(res, await svc.evaluationFile(id, req.query, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
