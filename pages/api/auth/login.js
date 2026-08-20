// =============================================================
// POST /api/auth/login
// -------------------------------------------------------------
// يستقبل بريداً وكلمة مرور، يرجع رمز مصادقة وبيانات المستخدم
// =============================================================

const { withMethods, withValidation, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');
const { loginSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  try {
    return ok(res, await identity.login(req.valid));
  } catch (e) {
    return fail(res, e);
  }
}

// 10 محاولات كل دقيقة لكل IP
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 10, windowMs: 60_000 })(withValidation(loginSchema, handler)));
module.exports.default = module.exports;
