// =============================================================
// POST /api/auth/resend-otp
// -------------------------------------------------------------
// إعادة إرسال رمز التحقق لتسجيل الدخول (مهلة دقيقة بين كل طلبين)
// =============================================================

const { withMethods, withValidation, ok, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');
const { resendOtpSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  try {
    return ok(res, await identity.resendLoginOtp(req.valid));
  } catch (e) {
    return fail(res, e);
  }
}

// 5 طلبات كل 10 دقائق لكل IP
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 5, windowMs: 10 * 60_000 })(withValidation(resendOtpSchema, handler)));
module.exports.default = module.exports;
