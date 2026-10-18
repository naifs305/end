// =============================================================
// POST /api/auth/verify-otp
// -------------------------------------------------------------
// الخطوة الثانية لتسجيل الدخول: يستقبل رمز التحدي (mfaToken) ورمز
// التحقق المُرسَل بالبريد، ويرجع رمز المصادقة وبيانات المستخدم
// =============================================================

const { withMethods, withValidation, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');
const { verifyOtpSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  try {
    return ok(res, await identity.verifyLoginOtp(req.valid));
  } catch (e) {
    return fail(res, e);
  }
}

// 10 محاولات كل دقيقة لكل IP (إضافةً لحد ٥ محاولات لكل رمز في الخدمة)
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 10, windowMs: 60_000 })(withValidation(verifyOtpSchema, handler)));
module.exports.default = module.exports;
