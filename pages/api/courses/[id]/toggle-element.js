// POST /api/courses/[id]/toggle-element
// { trackingId, enabled }
// تفعيل/تعطيل عنصر اختياري (OPTIONAL) لهذه الدورة — للمنسق أو المشرف أو المدير
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const { logAudit } = require('../../../../lib/services/audit');

async function handler(req, res) {
  const { id } = req.query;
  const { trackingId, enabled } = req.body || {};
  const { user, activeRole } = req;

  if (!trackingId || typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'trackingId و enabled مطلوبان' });
  }

  const tracking = await prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: { element: true, course: { select: { id: true, primaryEmployeeId: true } } },
  });

  if (!tracking || tracking.courseId !== id) {
    return res.status(404).json({ message: 'العنصر غير موجود' });
  }

  if (tracking.element.elementType !== 'OPTIONAL') {
    return res.status(400).json({ message: 'هذا العنصر ليس اختيارياً' });
  }

  const isCoordinator = tracking.course.primaryEmployeeId === user.id;
  const isApprover = ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);
  if (!isCoordinator && !isApprover) {
    return res.status(403).json({ message: 'غير مصرح' });
  }

  if (['APPROVED', 'PENDING_APPROVAL'].includes(tracking.status) && !enabled) {
    return res.status(400).json({ message: 'لا يمكن إلغاء عنصر مُقدّم أو مُعتمد' });
  }

  const updated = await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { status: enabled ? 'NOT_STARTED' : 'NOT_APPLICABLE' },
  });

  await logAudit(user.id, activeRole, 'COURSE_OPTIONAL_ELEMENT_TOGGLED', {
    courseId: id, elementId: tracking.elementId, elementName: tracking.element.name, enabled,
  }, id);

  return res.status(200).json(updated);
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
