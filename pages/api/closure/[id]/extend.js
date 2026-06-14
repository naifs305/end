// POST /api/closure/[id]/extend
// المدير فقط — منح تمديد لموعد عنصر إقفال محدد
const prisma = require('../../../../lib/db/prisma');
const { withManager, withMethods } = require('../../../../lib/middleware/auth');
const { logAudit } = require('../../../../lib/services/audit');
const { createNotification } = require('../../../../lib/services/notifications');
const { isPositiveInt, isNonEmptyString } = require('../../../../lib/middleware/validate');

async function handler(req, res) {
  const { id } = req.query;
  const { extensionHours, extensionReason } = req.body || {};

  if (!isPositiveInt(extensionHours) || Number(extensionHours) === 0) {
    return res.status(400).json({ message: 'عدد ساعات التمديد يجب أن يكون رقماً موجباً' });
  }
  if (!isNonEmptyString(extensionReason, 500)) {
    return res.status(400).json({ message: 'سبب التمديد مطلوب' });
  }

  try {
    const tracking = await prisma.courseClosureTracking.findUnique({
      where: { id },
      include: {
        element: true,
        course: { include: { primaryEmployee: true } },
      },
    });

    if (!tracking) {
      return res.status(404).json({ message: 'عنصر الإقفال غير موجود' });
    }

    if (['APPROVED', 'NOT_APPLICABLE'].includes(tracking.status)) {
      return res.status(400).json({ message: 'لا يمكن منح تمديد لعنصر مكتمل أو غير مطلوب' });
    }

    const updated = await prisma.courseClosureTracking.update({
      where: { id },
      data: {
        extensionHours: Number(extensionHours),
        extensionReason: extensionReason.trim(),
        extensionGrantedById: req.user.id,
        extensionGrantedAt: new Date(),
      },
      include: { element: true, course: true },
    });

    // إشعار الموظف بالتمديد
    await createNotification(
      tracking.course.primaryEmployeeId,
      'ELEMENT_EXTENSION_GRANTED',
      `تمديد موعد: ${tracking.element.name}`,
      `منحك المدير تمديداً لـ ${extensionHours} ساعة على العنصر "${tracking.element.name}" في الدورة "${tracking.course.name}". السبب: ${extensionReason.trim()}.`,
      { trackingId: id, courseId: tracking.courseId, elementName: tracking.element.name, extensionHours: Number(extensionHours) },
    );

    await logAudit(req.user.id, 'MANAGER', 'ELEMENT_EXTENSION_GRANTED', {
      trackingId: id,
      elementName: tracking.element.name,
      extensionHours: Number(extensionHours),
      extensionReason: extensionReason.trim(),
    }, tracking.courseId);

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
