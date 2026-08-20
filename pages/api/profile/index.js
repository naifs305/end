// =============================================================
// GET/PATCH /api/profile
// -------------------------------------------------------------
// الملف الشخصي للمستخدم الحالي: عرض/تعديل الاسم، الهاتف،
// التحويلة، الصورة الشخصية، والتوقيع الإلكتروني.
// لا يسمح بتعديل الدور (roles) — هذا حصري للمدير عبر /api/users/[id]
// =============================================================

const { withAuth, withMethods, ok, fail } = require('../../../lib/server/http');
const identity = require('../../../lib/modules/identity/identity.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole, user: req.user };
  try {
    if (req.method === 'GET') {
      return ok(res, await identity.getProfile(actor));
    }
    // PATCH — تعديل الملف الشخصي
    return ok(res, await identity.updateProfile(req.body || {}, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PATCH'], withAuth(handler));
module.exports.default = module.exports;

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
    responseLimit: '12mb',
  },
};
