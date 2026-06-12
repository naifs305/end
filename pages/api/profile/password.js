// =============================================================
// PUT /api/profile/password
// -------------------------------------------------------------
// تغيير كلمة مرور المستخدم الحالي — يتطلب كلمة المرور الحالية
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const { hashPassword, verifyPassword } = require('../../../lib/auth/jwt');
const { validatePasswordReset } = require('../../../lib/middleware/validate');

async function handler(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword) {
    return res.status(400).json({ message: 'كلمة المرور الحالية مطلوبة' });
  }

  const v = validatePasswordReset({ password: newPassword });
  if (!v.valid) return res.status(400).json({ message: v.message });

  const fullUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, passwordHash: true },
  });

  const matches = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!matches) {
    return res.status(400).json({ message: 'كلمة المرور الحالية غير صحيحة' });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

  return res.status(200).json({ message: 'تم تغيير كلمة المرور بنجاح' });
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
