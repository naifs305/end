// POST /api/courses/[id]/toggle-report
// { type: 'opening' | 'closing', enabled: boolean }
// مشرف المشروع أو المدير يفعّل/يعطّل تقرير على دورة قائمة
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const { logAudit } = require('../../../../lib/services/audit');
const { refreshConditionalElements } = require('../../../../lib/services/courses');

async function handler(req, res) {
  const { id } = req.query;
  const { type, enabled } = req.body || {};
  const { user, activeRole } = req;

  if (!['opening', 'closing'].includes(type)) {
    return res.status(400).json({ message: 'type يجب أن يكون opening أو closing' });
  }
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled يجب أن يكون boolean' });
  }
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole)) {
    return res.status(403).json({ message: 'غير مصرح' });
  }

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return res.status(404).json({ message: 'الدورة غير موجودة' });

  const field = type === 'opening' ? 'requiresOpeningReport' : 'requiresClosingReport';
  const elKey = type === 'opening' ? 'opening_report' : 'closing_report';

  await prisma.course.update({ where: { id }, data: { [field]: enabled } });

  // تحديث حالة العنصر في عناصر الإقفال
  const element = await prisma.closureElement.findFirst({ where: { key: elKey } });
  if (element) {
    await prisma.courseClosureTracking.updateMany({
      where: { courseId: id, elementId: element.id,
        // لا نعيد فتح عنصر تم اعتماده بالفعل
        status: { notIn: ['APPROVED'] },
      },
      data: { status: enabled ? 'NOT_STARTED' : 'NOT_APPLICABLE' },
    });
  }

  await logAudit(user.id, activeRole, 'COURSE_REPORT_TOGGLED', {
    courseId: id, type, enabled,
  }, id);

  return res.status(200).json({ success: true, [field]: enabled });
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
