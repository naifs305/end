// =============================================================
// PUT /api/profile/password
// -------------------------------------------------------------
// تغيير كلمة مرور المستخدم الحالي — يتطلب كلمة المرور الحالية
// =============================================================

const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    return ok(res, await identity.changePassword(req.body || {}, actor));
  } catch (e) {
    return fail(res, e);
  }
}

// 10 محاولات كل 15 دقيقة لكل IP — للحد من تخمين كلمة المرور الحالية رغم وجود withAuth.
// المحدد في الذاكرة لكل instance (best-effort)؛ مخزن موزّع تحسين مستقبلي
module.exports = withMethods(['PUT'], withRateLimit({ maxAttempts: 10, windowMs: 15 * 60_000 })(withAuth(handler)));
module.exports.default = module.exports;
