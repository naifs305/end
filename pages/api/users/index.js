const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const { buildUsersWhere } = require('../../../lib/services/permissions');

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
  const where = await buildUsersWhere(req.user, req.activeRole);

  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
  });

  return res.status(200).json(users);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
