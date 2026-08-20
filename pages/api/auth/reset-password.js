// POST /api/auth/reset-password  { token, password }
const { withMethods, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  try {
    return ok(res, await identity.resetPassword(req.body || {}));
  } catch (e) {
    return fail(res, e);
  }
}

// 10 محاولات كل 15 دقيقة لكل IP — المحدد في الذاكرة لكل instance (best-effort)؛
// مخزن موزّع تحسين مستقبلي
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 10, windowMs: 15 * 60_000 })(handler));
module.exports.default = module.exports;
