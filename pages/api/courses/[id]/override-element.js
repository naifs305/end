// POST /api/courses/[id]/override-element
// { trackingId, action: 'revert' | 'exempt' | 'restore', reason }
// تحكم المدير في عناصر الإقفال:
//  - revert : إرجاع عنصر مُعتمد (APPROVED) إلى "لم يبدأ" مع سبب (إلزامي)
//  - exempt : وضع عنصر كاستثناء "غير منطبق" مع سبب (إلزامي)
//  - restore: إلغاء استثناء عنصر مُستثنى وإرجاعه إلى "لم يبدأ"
const prisma = require('../../../../lib/db/prisma');
const { withMethods, withManager } = require('../../../../lib/middleware/auth');
const { logAudit } = require('../../../../lib/services/audit');

const ACTIONS = ['revert', 'exempt', 'restore'];

async function handler(req, res) {
  const { id } = req.query;
  const { trackingId, action, reason } = req.body || {};
  const { user, activeRole } = req;

  if (!trackingId || !ACTIONS.includes(action)) {
    return res.status(400).json({ message: 'trackingId و action صالح مطلوبان' });
  }

  if (['revert', 'exempt'].includes(action) && !reason?.trim()) {
    return res.status(400).json({ message: 'السبب مطلوب لهذا الإجراء' });
  }

  const tracking = await prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: { element: true },
  });

  if (!tracking || tracking.courseId !== id) {
    return res.status(404).json({ message: 'العنصر غير موجود' });
  }

  let data;
  let auditAction;

  if (action === 'revert') {
    if (tracking.status !== 'APPROVED') {
      return res.status(400).json({ message: 'لا يمكن استرجاع عنصر غير معتمد' });
    }
    data = {
      status: 'NOT_STARTED',
      overrideReason: reason.trim(),
      overriddenAt: new Date(),
      overriddenById: user.id,
    };
    auditAction = 'CLOSURE_ELEMENT_REVERTED';
  } else if (action === 'exempt') {
    if (tracking.status === 'NOT_APPLICABLE') {
      return res.status(400).json({ message: 'العنصر غير منطبق بالفعل' });
    }
    data = {
      status: 'NOT_APPLICABLE',
      overrideReason: reason.trim(),
      overriddenAt: new Date(),
      overriddenById: user.id,
    };
    auditAction = 'CLOSURE_ELEMENT_EXEMPTED';
  } else {
    if (tracking.status !== 'NOT_APPLICABLE' || !tracking.overriddenById) {
      return res.status(400).json({ message: 'لا يمكن استرجاع هذا العنصر' });
    }
    data = {
      status: 'NOT_STARTED',
      overrideReason: null,
      overriddenAt: null,
      overriddenById: null,
    };
    auditAction = 'CLOSURE_ELEMENT_EXEMPTION_RESTORED';
  }

  const updated = await prisma.courseClosureTracking.update({ where: { id: trackingId }, data });

  await logAudit(user.id, activeRole, auditAction, {
    courseId: id, elementId: tracking.elementId, elementName: tracking.element.name, reason: reason?.trim() || null,
  }, id);

  return res.status(200).json(updated);
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
