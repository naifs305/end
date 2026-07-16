// POST /api/courses/[id]/manager-message
// { trackingId, messageType: 'INQUIRY'|'REMINDER'|'WARNING', message }
// المدير يرسل رسالة موجّهة لموظف عن عنصر إقفال بعينه
const prisma = require('../../../../lib/db/prisma');
const { withMethods, withManager } = require('../../../../lib/middleware/auth');
const { createNotification } = require('../../../../lib/services/notifications');
const { logAudit } = require('../../../../lib/services/audit');

const MSG_TYPES = ['INQUIRY', 'REMINDER', 'WARNING'];

const TYPE_META = {
  INQUIRY:  { label: 'استفسار',  icon: '💬', notifType: 'MANAGER_INQUIRY'  },
  REMINDER: { label: 'تذكير',    icon: '🔔', notifType: 'MANAGER_REMINDER' },
  WARNING:  { label: 'إنذار',    icon: '🚨', notifType: 'MANAGER_WARNING'  },
};

async function handler(req, res) {
  const { id } = req.query;
  const { trackingId, messageType, message } = req.body || {};
  const { user } = req;

  if (!trackingId || !MSG_TYPES.includes(messageType) || !message?.trim()) {
    return res.status(400).json({ message: 'trackingId ونوع الرسالة والمحتوى مطلوبة' });
  }

  const tracking = await prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element:    { select: { name: true } },
      executedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!tracking || tracking.courseId !== id) {
    return res.status(404).json({ message: 'العنصر غير موجود في هذه الدورة' });
  }

  const meta = TYPE_META[messageType];
  const employeeId = tracking.executedById;

  if (!employeeId) {
    return res.status(400).json({ message: 'لا يوجد موظف مسؤول عن هذا العنصر' });
  }

  // إنشاء إشعار للموظف
  await createNotification(
    employeeId,
    meta.notifType,
    `${meta.icon} ${meta.label} من المدير — ${tracking.element?.name}`,
    message.trim(),
    {
      courseId:   id,
      trackingId,
      elementName: tracking.element?.name,
      managerId:  user.id,
      managerName: `${user.firstName} ${user.lastName}`,
      messageType,
    }
  );

  await logAudit(
    user.id,
    req.activeRole,
    'MANAGER_MESSAGE_SENT',
    {
      courseId: id,
      trackingId,
      elementName: tracking.element?.name,
      employeeId,
      employeeName: `${tracking.executedBy?.firstName} ${tracking.executedBy?.lastName}`,
      messageType,
      message: message.trim(),
    },
    id
  );

  return res.status(200).json({ ok: true });
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
