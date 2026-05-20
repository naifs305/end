// DELETE /api/users/[id]/delete — المدير فقط، يحذف المستخدم إذا لم يكن له دورات
const prisma = require('../../../../lib/db/prisma');
const { withManager, withMethods } = require('../../../../lib/middleware/auth');

async function handler(req, res) {
  const { id } = req.query;

  if (id === req.user.id) {
    return res.status(400).json({ message: 'لا يمكن حذف حسابك الخاص' });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

  const courseCount = await prisma.course.count({ where: { primaryEmployeeId: id } });

  if (courseCount > 0) {
    // لا نحذف — نعطّل فقط
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return res.status(200).json({
      action: 'deactivated',
      message: `تم تعطيل الحساب (لديه ${courseCount} دورة مسجلة — الحذف الكامل يحتاج حذف الدورات أولاً)`,
    });
  }

  // حذف كامل — سلسلة الحذف تُزيل الإشعارات والرسائل والـ KPI
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.auditLog.deleteMany({ where: { userId: id } }),
    prisma.employeeKpiNote.deleteMany({ where: { OR: [{ userId: id }, { managerId: id }] } }),
    prisma.employeeKpiSnapshot.deleteMany({ where: { userId: id } }),
    prisma.courseAssignmentRegister.deleteMany({ where: { userId: id } }),
    prisma.courseSupport.deleteMany({ where: { userId: id } }),
    prisma.messageRecipient.deleteMany({ where: { userId: id } }),
    prisma.message.deleteMany({ where: { senderId: id } }),
    prisma.projectSupervisor.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return res.status(200).json({ action: 'deleted', message: 'تم حذف الحساب نهائياً' });
}

module.exports = withMethods(['DELETE'], withManager(handler));
module.exports.default = module.exports;
