// DELETE /api/users/[id]/delete — المدير فقط
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
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    return res.status(200).json({
      action: 'deactivated',
      message: `تم تعطيل الحساب (لا يزال لديه ${courseCount} دورة)`,
    });
  }

  // حذف تدريجي — كل جدول منفصل
  try { await prisma.courseClosureTracking.updateMany({ where: { executedById: id }, data: { executedById: null } }); } catch {}
  try { await prisma.courseClosureTracking.updateMany({ where: { decidedById: id }, data: { decidedById: null } }); } catch {}
  try { await prisma.courseClosureTracking.updateMany({ where: { extensionGrantedById: id }, data: { extensionGrantedById: null } }); } catch {}
  try { await prisma.notification.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.auditLog.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.employeeKpiNote.deleteMany({ where: { OR: [{ userId: id }, { managerId: id }] } }); } catch {}
  try { await prisma.employeeKpiSnapshot.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.courseAssignmentRegister.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.courseSupport.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.messageRecipient.deleteMany({ where: { userId: id } }); } catch {}
  try { await prisma.message.deleteMany({ where: { senderId: id } }); } catch {}
  try { await prisma.projectSupervisor.deleteMany({ where: { userId: id } }); } catch {}

  await prisma.user.delete({ where: { id } });

  return res.status(200).json({ action: 'deleted', message: 'تم حذف الحساب نهائياً ✓' });
}

module.exports = withMethods(['DELETE'], withManager(handler));
module.exports.default = module.exports;
