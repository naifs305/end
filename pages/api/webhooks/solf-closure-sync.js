/**
 * POST /api/webhooks/solf-closure-sync
 *
 * يقفل عناصر السلف القادمة من منصة السلف مباشرة بعد الطباعة.
 */
const crypto = require('crypto');
const prisma = require('../../../lib/db/prisma');
const { checkCourseClosure } = require('../../../lib/modules/closure/closure.service');
const { logAudit } = require('../../../lib/services/audit');

function withMethods(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return res.status(405).json({ message: 'Method Not Allowed', code: 'serverErrors.common.methodNotAllowed' });
    return handler(req, res);
  };
}

// مقارنة بزمن ثابت لمنع هجمات التوقيت
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// قراءة السر من ترويسة Authorization أو x-webhook-secret (وليس من جسم الطلب)
function readSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.headers['x-webhook-secret'] || '';
}

function toDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function handler(req, res) {
  const body = req.body || {};
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.SOLF_WEBHOOK_SECRET;

  if (!expectedSecret || !safeEqual(readSecret(req), expectedSecret)) {
    return res.status(401).json({ message: 'Unauthorized', code: 'serverErrors.common.unauthorized' });
  }

  const type = body.type;
  if (!['advance_req', 'settlement'].includes(type)) {
    return res.status(400).json({ message: 'type must be advance_req or settlement', code: 'serverErrors.webhooks.invalidType' });
  }

  if (!body.courseId) {
    return res.status(400).json({ message: 'courseId مطلوب', code: 'serverErrors.webhooks.courseIdRequired' });
  }

  try {
    const tracking = await prisma.courseClosureTracking.findFirst({
      where: {
        courseId: body.courseId,
        element: { key: type },
      },
      include: {
        element: true,
        course: { select: { id: true, name: true, primaryEmployeeId: true } },
      },
    });

    if (!tracking) {
      return res.status(404).json({ ok: false, action: 'element_not_found' });
    }

    if (tracking.status === 'APPROVED') {
      return res.status(200).json({ ok: true, action: 'already_approved', trackingId: tracking.id });
    }

    const employee = body.employeeEmail
      ? await prisma.user.findUnique({ where: { email: String(body.employeeEmail).toLowerCase() }, select: { id: true } })
      : null;
    const actorId = employee?.id || tracking.course.primaryEmployeeId;
    const now = toDate(body.printedAt || body.syncedAt);
    const label = type === 'advance_req' ? 'طلب السلفة' : 'تسوية السلفة';

    const updated = await prisma.courseClosureTracking.update({
      where: { id: tracking.id },
      data: {
        status: 'APPROVED',
        executionAt: now,
        executedById: actorId,
        decisionAt: now,
        decidedById: actorId,
        rejectionReason: null,
        notes: `${label} مكتمل من منصة السلف${body.referenceNumber ? ` — ${body.referenceNumber}` : ''}`,
        formData: {
          source: 'solf',
          type,
          referenceNumber: body.referenceNumber || null,
          amount: body.amount ?? null,
          advanceAmount: body.advanceAmount ?? null,
          spentAmount: body.spentAmount ?? null,
          employeeEmail: body.employeeEmail || null,
          printedAt: now.toISOString(),
          solfLoanId: body.solfLoanId || null,
        },
      },
    });

    // تسجيل في سجل التدقيق على مسار النجاح (logAudit يبتلع أخطاءه بنفسه)
    await logAudit(actorId, 'WEBHOOK', 'WEBHOOK_ELEMENT_APPROVED', {
      elementKey: tracking.element.key,
      source: 'solf',
      type,
      referenceNumber: body.referenceNumber || null,
      amount: body.amount ?? null,
    }, body.courseId);

    await checkCourseClosure(body.courseId);

    return res.status(200).json({ ok: true, action: 'approved', trackingId: updated.id });
  } catch (err) {
    console.error('[Webhook] solf-closure-sync error:', err);
    return res.status(500).json({ message: 'خطأ داخلي', code: 'serverErrors.common.serverError' });
  }
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
