const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const {
  canEditUserBasicInfo,
  canChangeUserRoles,
} = require('../../../lib/services/permissions');

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

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!targetUser) {
    return res.status(404).json({ message: 'المستخدم غير موجود' });
  }

  if (req.method === 'GET') {
    const allowed = await canEditUserBasicInfo(req.user, req.activeRole, targetUser);
    if (!allowed) {
      return res.status(403).json({ message: 'لا تملك صلاحية عرض هذا المستخدم' });
    }

    return res.status(200).json(targetUser);
  }

  const allowed = await canEditUserBasicInfo(req.user, req.activeRole, targetUser);
  if (!allowed) {
    return res.status(403).json({ message: 'لا تملك صلاحية تعديل هذا المستخدم' });
  }

  const { passwordHash, id: _id, createdAt, updatedAt, roles, ...safe } = req.body || {};
  const data = { ...safe };

  if (Array.isArray(roles) && canChangeUserRoles(req.activeRole)) {
    data.roles = roles;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  return res.status(200).json(updated);
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
