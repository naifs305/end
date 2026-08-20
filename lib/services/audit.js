const prisma = require('../db/prisma');

async function logAudit(userId, roleContext, action, details, courseId = null) {
  try {
    // الإجراءات النظامية (cron/إغلاق تلقائي) لا تملك مستخدماً حقيقياً → userId = null
    const actorId = userId && userId !== 'system' ? userId : null;
    await prisma.auditLog.create({
      data: {
        userId: actorId,
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
