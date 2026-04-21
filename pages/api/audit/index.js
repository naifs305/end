const prisma = require('../../../lib/db/prisma');
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const { buildAuditWhere } = require('../../../lib/services/permissions');

async function handler(req, res) {
  try {
    const where = await buildAuditWhere(req.user, req.activeRole, {
      ...(req.query.userId ? { userId: req.query.userId } : {}),
      ...(req.query.action ? { action: { contains: req.query.action, mode: 'insensitive' } } : {}),
    });

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
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
