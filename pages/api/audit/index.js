const prisma = require('../../../lib/db/prisma');
const { withManagerOrSupervisor, withMethods } = require('../../../lib/middleware/auth');
const { buildAuditWhere } = require('../../../lib/services/permissions');

async function handler(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const allowedActions = [
      'COURSE_CREATED', 'COURSE_UPDATED', 'COURSE_DELETED', 'COURSE_ARCHIVED',
      'COURSE_REASSIGNED', 'ELEMENT_SUBMITTED', 'ELEMENT_APPROVED', 'ELEMENT_REJECTED',
      'ELEMENT_RETURNED', 'KPI_SNAPSHOTS_CALCULATED', 'KPI_NOTE_ADDED',
      'ASSIGNMENT_REGISTER_UPDATED',
    ];
    const actionFilter = req.query.action && allowedActions.includes(req.query.action.toUpperCase())
      ? { action: req.query.action.toUpperCase() }
      : req.query.action
      ? { action: { contains: req.query.action, mode: 'insensitive' } }
      : {};

    const where = await buildAuditWhere(req.user, req.activeRole, {
      ...(req.query.userId ? { userId: req.query.userId } : {}),
      ...actionFilter,
    });

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          course: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return res.status(200).json({
      data: logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
