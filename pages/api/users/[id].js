// =============================================================
// GET/PUT /api/users/[id]
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { withManager, withMethods } = require('../../../lib/middleware/auth');

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  mobileNumber: true,
  extensionNumber: true,
  roles: true,
  isActive: true,
  operationalProjectId: true,
  operationalProject: true,
  createdAt: true,
  updatedAt: true,
};

async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
    return res.status(200).json(user);
  }

  if (req.method === 'PUT') {
    // حذف الحقول غير المسموح بها مباشرة
    const { passwordHash, id: _id, createdAt, updatedAt, ...safe } = req.body || {};

    const updated = await prisma.user.update({
      where: { id },
      data: safe,
      select: userSelect,
    });

    return res.status(200).json(updated);
  }

  return res.status(405).json({ message: 'طريقة غير مسموحة' });
}

module.exports = withMethods(['GET', 'PUT'], withManager(handler));
module.exports.default = module.exports;
