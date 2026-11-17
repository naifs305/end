// GET /api/points/meta — قواعد الاحتساب والسنوات المتاحة ومقاييس تحدي الشهر
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/points/points.service');

async function handler(req, res) {
  try {
    const metrics = Object.entries(svc.CHALLENGE_METRICS).map(([key, m]) => ({ key, ...m }));
    return ok(res, { rules: svc.rules(), years: await svc.years(), challengeMetrics: metrics });
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
