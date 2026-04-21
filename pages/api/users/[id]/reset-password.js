const prisma = require('../../../../lib/db/prisma');
const { hashPassword } = require('../../../../lib/auth/jwt');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const { canResetUserPassword } = require('../../../../lib/services/permissions');

async function handler(req, res) {
  const { id } = req.query;
  const { password } = req.body || {};

  if (!password || String(password).length < 6) {
    return res.status(400).json({ message: 'كلمة المرور لا تقل عن 6 أحرف' });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, roles: true, operationalProjectId: true },
  });

  if (!targetUser) {
    return res.status(404).json({ message: 'المستخدم غير موجود' });
  }

  const allowed = await canResetUserPassword(req.user, req.activeRole, targetUser);
  if (!allowed) {
    return res.status(403).json({ message: 'لا تملك صلاحية إعادة التعيين' });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id }, data: { passwordHash } });

  return res.status(200).json({ message: 'تمت إعادة تعيين كلمة المرور' });
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
