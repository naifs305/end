// =============================================================
// PUT /api/users/[id]/reset-password
// =============================================================

const prisma = require('../../../../lib/db/prisma');
const { hashPassword } = require('../../../../lib/auth/jwt');
const { withManager, withMethods } = require('../../../../lib/middleware/auth');

async function handler(req, res) {
  const { id } = req.query;
  const { password } = req.body || {};

  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'كلمة المرور لا تقل عن ٦ أحرف' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return res.status(200).json({ message: 'تمت إعادة تعيين كلمة المرور' });
}

module.exports = withMethods(['PUT'], withManager(handler));
module.exports.default = module.exports;
