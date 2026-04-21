// =============================================================
// خدمة التدقيق المشتركة
// -------------------------------------------------------------
// تُستخدم من مسارات متعددة لتسجيل العمليات في قاعدة البيانات
// =============================================================

const prisma = require('../db/prisma');

/**
 * تسجيل عملية في سجل التدقيق
 */
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
  } catch (err) {
    console.error('فشل تسجيل عملية التدقيق:', err);
    // لا نرمي الخطأ — التدقيق لا يجب أن يوقف العمليات الأساسية
  }
}

module.exports = { logAudit };
