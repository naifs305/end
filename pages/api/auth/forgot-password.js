// POST /api/auth/forgot-password  { email }
const { withMethods, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  try {
    // الخدمة تُرجع دائماً نجاحاً (200) لمنع تخمين الحسابات
    return ok(res, await identity.forgotPassword(req.body || {}));
  } catch (e) {
    return fail(res, e);
  }
}

// 5 محاولات كل 15 دقيقة لكل IP — المحدد في الذاكرة لكل instance (best-effort)؛
// مخزن موزّع تحسين مستقبلي
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 5, windowMs: 15 * 60_000 })(handler));
module.exports.default = module.exports;
