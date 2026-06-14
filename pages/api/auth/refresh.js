// GET /api/auth/refresh — يُصدر token جديداً بالأدوار الحالية من قاعدة البيانات
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const { signToken } = require('../../../lib/auth/jwt');
const prisma = require('../../../lib/db/prisma');

async function handler(req, res) {
  const freshUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, roles: true, isActive: true, firstName: true, lastName: true,
      operationalProjectId: true, operationalProject: true },
  });

  if (!freshUser || !freshUser.isActive) {
    return res.status(403).json({ message: 'الحساب غير نشط' });
  }

  const access_token = signToken({ sub: freshUser.id, email: freshUser.email, roles: freshUser.roles });
  return res.status(200).json({ access_token, user: freshUser });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
