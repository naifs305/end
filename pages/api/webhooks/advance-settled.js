/**
 * POST /api/webhooks/advance-settled
 *
 * webhook جاهز لاستقبال إشعارات تسوية السلف من موقع السلف الخارجي
 *
 * الاستخدام المستقبلي:
 * عند اعتماد تسوية سلفة في موقع السلف → يُرسل طلب POST هنا
 * → يُحدَّث عنصر التسوية تلقائياً
 *
 * الحالة الحالية: جاهز للاستقبال لكن غير نشط (معلّق حتى اكتمال موقع السلف)
 *
 * Body المتوقع:
 * {
 *   secret: string,          // WEBHOOK_SECRET من env
 *   courseId: string,        // معرف الدورة
 *   employeeId: string,      // معرف الموظف
 *   amount: number,          // قيمة التسوية
 *   settledAt: string,       // تاريخ التسوية ISO
 *   referenceNumber: string  // رقم مرجعي (اختياري)
 * }
 */
const prisma = require('../../../lib/db/prisma');

function withMethods(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return res.status(405).json({ message: 'Method Not Allowed' });
    return handler(req, res);
  };
}

async function handler(req, res) {
  const { secret, courseId, employeeId, amount, settledAt, referenceNumber } = req.body || {};

  // التحقق من السر
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!courseId || !employeeId) {
    return res.status(400).json({ message: 'courseId و employeeId مطلوبان' });
  }

  try {
    // البحث عن عنصر التسوية لهذه الدورة
    const tracking = await prisma.courseClosureTracking.findFirst({
      where: {
        courseId,
        element: { key: 'settlement' },
        status: { in: ['NOT_STARTED', 'RETURNED', 'PENDING_APPROVAL'] },
      },
      include: { element: true, course: true },
    });

    if (!tracking) {
      // العنصر غير موجود أو مُعتمد بالفعل — نسجّل ونرد بنجاح
      console.log(`[Webhook] advance-settled: no pending settlement for course ${courseId}`);
      return res.status(200).json({ ok: true, action: 'no_pending_element' });
    }

    // تحديث العنصر إلى PENDING_APPROVAL مع ملاحظة التسوية
    await prisma.courseClosureTracking.update({
      where: { id: tracking.id },
      data: {
        status:      'PENDING_APPROVAL',
        executedById: employeeId,
        executionAt:  settledAt ? new Date(settledAt) : new Date(),
        notes: referenceNumber ? `تسوية مكتملة — رقم مرجعي: ${referenceNumber}${amount ? ` — المبلغ: ${amount} ريال` : ''}` : 'تسوية مكتملة من نظام السلف',
      },
    });

    console.log(`[Webhook] advance-settled: updated settlement for course ${courseId}`);

    return res.status(200).json({
      ok: true,
      action: 'element_updated',
      trackingId: tracking.id,
    });

  } catch (err) {
    console.error('[Webhook] advance-settled error:', err.message);
    return res.status(500).json({ message: 'خطأ داخلي' });
  }
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
