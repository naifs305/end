const prisma = require('../db/prisma');

async function logAudit(userId, roleContext, action, details, courseId = null) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        roleContext,
        action,
        details: details || {},
        courseId,
      },
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}

module.exports = { logAudit };
