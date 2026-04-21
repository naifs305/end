// =============================================================
// GET /api/users/me
// -------------------------------------------------------------
// يرجع بيانات المستخدم الحالي (يستدعيه سياق المصادقة في الواجهة)
// =============================================================

const { withAuth, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const user = req.user;

  return res.status(200).json({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber,
    extensionNumber: user.extensionNumber,
    roles: user.roles,
    project: user.operationalProject,
    isActive: user.isActive,
  });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
