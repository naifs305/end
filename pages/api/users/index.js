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

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
  const skip = (page - 1) * limit;

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
      skip,
      take: limit,
    }),
  ]);

  return res.status(200).json({ data: users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
