// PUT /api/evaluation/rating { year, userId, rating } — تقدير المدير (خانة واحدة من ١٠٠)
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/points/points.service');

async function handler(req, res) {
  try {
    // التقدير يُقرأ في كل طلب، فلا حاجة لإعادة حساب السجل
    return ok(res, await svc.setRating(req.body || {}, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
