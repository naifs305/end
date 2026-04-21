// GET /api/audit (للمدير فقط)
const prisma = require('../../../lib/db/prisma');
const { withManager, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const { userId, action } = req.query;
  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action, mode: 'insensitive' };

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      course: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return res.status(200).json(logs);
}

module.exports = withMethods(['GET'], withManager(handler));
module.exports.default = module.exports;
