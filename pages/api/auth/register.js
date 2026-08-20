// =============================================================
// POST /api/auth/register
// -------------------------------------------------------------
// إنشاء حساب جديد
// =============================================================

const { withMethods, withValidation, created, fail } = require('../../../lib/server/http');
const { withRateLimit } = require('../../../lib/middleware/rateLimit');
const identity = require('../../../lib/modules/identity/identity.service');
const { registerSchema } = require('../../../lib/modules/identity/identity.schema');

async function handler(req, res) {
  try {
    return created(res, await identity.register(req.valid));
  } catch (e) {
    return fail(res, e);
  }
}

// 5 تسجيلات كل دقيقة لكل IP
module.exports = withMethods(['POST'], withRateLimit({ maxAttempts: 5, windowMs: 60_000 })(withValidation(registerSchema, handler)));
module.exports.default = module.exports;
