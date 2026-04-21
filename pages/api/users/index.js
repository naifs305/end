// =============================================================
// GET/POST /api/users  (قائمة المستخدمين للمدير)
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { withManager, withMethods, withAuth } = require('../../../lib/middleware/auth');

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
  if (req.method === 'GET') {
    // المدير يرى كل المستخدمين، الموظف يرى زملاءه فقط (نفس المشروع)
    const isManager = req.user.roles.includes('MANAGER') && req.activeRole === 'MANAGER';

    const where = isManager
      ? {}
      : { operationalProjectId: req.user.operationalProjectId, isActive: true };

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    });

    return res.status(200).json(users);
  }

  return res.status(405).json({ message: 'طريقة غير مسموحة' });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
