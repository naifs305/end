// POST /api/courses/[id]/toggle-report
// { type: 'opening' | 'closing', enabled: boolean }
// المدير/المشرف: يفعّل أو يعطّل التقرير ويجعله إجبارياً رسمياً على الدورة.
// الموظف المسؤول عن الدورة (أو الداعم): يمكنه تفعيله تطوّعاً فقط (لا يملك تعطيله) عندما لا يكون إجبارياً —
// يُمنح تقدير في المؤشرات عند اعتماده لاحقاً لأنه عمل تطوّعي وليس مطلوباً.
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const { logAudit } = require('../../../../lib/services/audit');
const { createNotification } = require('../../../../lib/services/notifications');
const permissions = require('../../../../lib/services/permissions');

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

  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) return res.status(404).json({ message: 'الدورة غير موجودة' });

  const field = type === 'opening' ? 'requiresOpeningReport' : 'requiresClosingReport';
  const voluntaryField = type === 'opening' ? 'openingReportVoluntary' : 'closingReportVoluntary';
  const elKey = type === 'opening' ? 'opening_report' : 'closing_report';

  const isManagerOrSupervisor = ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);
  let updateData;

  if (isManagerOrSupervisor) {
    // المسار الرسمي: يجعل التقرير إجبارياً/غير إجباري على الدورة
    updateData = { [field]: enabled, [voluntaryField]: false };
  } else {
    // مسار الموظف: تفعيل تطوّعي فقط، ولا يملك تعطيل تقرير مفعّل أصلاً
    if (!enabled) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    if (course[field]) {
      return res.status(400).json({ message: 'التقرير مفعّل بالفعل على هذه الدورة' });
    }
    const allowed = await permissions.canSubmitElement(user, activeRole, course);
    if (!allowed) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    updateData = { [field]: true, [voluntaryField]: true };
  }

  await prisma.course.update({ where: { id }, data: updateData });

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
    courseId: id, type, enabled, voluntary: !isManagerOrSupervisor,
  }, id);

  // إشعار الموظف المسؤول عند تفعيل التقرير من قِبَل المدير/المشرف
  if (enabled && isManagerOrSupervisor && course.primaryEmployeeId && course.primaryEmployeeId !== user.id) {
    const reportName = type === 'opening' ? 'تقرير افتتاح الدورة' : 'تقرير اختتام الدورة';
    await createNotification(
      course.primaryEmployeeId,
      'ELEMENT_ASSIGNED',
      `تكليف جديد: ${reportName}`,
      `تم تكليفك بتقديم "${reportName}" لدورة "${course.name}" — يُرجى الدخول على الدورة وتقديم التقرير في الموعد المحدد.`,
      { courseId: id, elementKey: elKey },
    );
  }

  return res.status(200).json({ success: true, [field]: enabled, [voluntaryField]: updateData[voluntaryField] });
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
