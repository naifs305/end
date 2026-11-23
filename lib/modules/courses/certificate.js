// =============================================================
// نوع شهادة الدورة: حضور أو اجتياز
// -------------------------------------------------------------
// كان المنسق يبني الدورة على أنها اجتياز ثم يُفاجأ في اللحظة الأخيرة
// أنها حضور (أو العكس). فصار النوع يُسجَّل من إضافة الدورة:
//   • حضور أو اجتياز: مؤكَّد من البداية.
//   • بانتظار التحديد: يُفتح على المنسق عنصر «تأكيد نوع الشهادة»
//     موعده قبل إطلاق الشهادات — فهو المسؤول عن إصدارها، ولا تُطلق
//     شهادة قبل معرفة نوعها (فلا تُقدَّم الشهادات والنوع معلّق).
// والنوع يحدد العناصر: الاجتياز يستلزم الاختبار البعدي، والحضور لا
// اختبار فيه.
//
// وإن تغيّر النوع بعد تأكيده: يُسجَّل التغيير على إدارة تصميم البرامج
// التدريبية، ولا يُحاسَب المنسق على اختبار استجدّ بلا مهلة كافية
// (الاستثناء في lib/shared/deadlines).
// =============================================================
const prisma = require('../../db/prisma');
const { AppError } = require('../../shared/AppError');

const TYPES = ['ATTENDANCE', 'PASS', 'PENDING'];
const CONFIRMED = ['ATTENDANCE', 'PASS'];
const LABELS = { ATTENDANCE: 'حضور', PASS: 'اجتياز', PENDING: 'بانتظار التحديد' };
const ELEMENT_KEY = 'certificate_type';

const isConfirmed = (t) => CONFIRMED.includes(t);

/** ما يستلزمه النوع من الاختبارات (يُدمج في بيانات الدورة) */
function testFlagsFor(type) {
  if (type === 'PASS') return { requiresPostTest: true };
  if (type === 'ATTENDANCE') return { requiresPreTest: false, requiresPostTest: false };
  return {};
}

/**
 * حقول الدورة عند تعيين النوع — دالة صافية.
 * يرمي خطأً إن كان الانتقال غير مقبول (كالعودة إلى «بانتظار» بعد التأكيد).
 */
function transition(prev, next, now = new Date()) {
  if (!TYPES.includes(next)) throw AppError.badRequest('نوع الشهادة غير صالح', 'serverErrors.course.certificateTypeInvalid');
  if (prev === next) return { fields: {}, changed: false, confirmedNow: false, changedAfterConfirm: false };
  if (next === 'PENDING' && isConfirmed(prev)) {
    throw AppError.badRequest('نوع الشهادة مؤكَّد — يمكن تغييره إلى النوع الآخر لا إعادته إلى الانتظار', 'serverErrors.course.certificateTypeBackToPending');
  }
  const changedAfterConfirm = isConfirmed(prev) && isConfirmed(next);
  const fields = { certificateType: next, ...testFlagsFor(next) };
  if (isConfirmed(next)) fields.certificateTypeConfirmedAt = now;
  // تأكيد متأخر لما كان معلّقاً: يُعفي الاختبار الذي استجدّ به بلا مهلة
  if (prev === 'PENDING' && isConfirmed(next)) fields.certificateTypeResolvedAt = now;
  if (changedAfterConfirm) {
    fields.certificateTypeChangedAt = now;
    fields.certificateTypeChangeCount = { increment: 1 };
  }
  return { fields, changed: true, confirmedNow: isConfirmed(next) && !isConfirmed(prev), changedAfterConfirm };
}

/** حقول النوع عند إنشاء الدورة */
function createFields(type, now = new Date()) {
  if (!type) return {};
  if (!TYPES.includes(type)) throw AppError.badRequest('نوع الشهادة غير صالح', 'serverErrors.course.certificateTypeInvalid');
  return {
    certificateType: type,
    ...(isConfirmed(type) ? { certificateTypeConfirmedAt: now } : {}),
    ...testFlagsFor(type),
  };
}

/** يتحقق أن المجال يتبع مشروع الدورة، ويُرجع معرّف المجال (أو null) */
async function resolveDomain(domainId, operationalProjectId) {
  if (!domainId) return null;
  const domain = await prisma.projectDomain.findUnique({ where: { id: domainId }, select: { id: true, operationalProjectId: true } });
  if (!domain) throw AppError.badRequest('المجال غير موجود', 'serverErrors.course.domainNotFound');
  if (operationalProjectId && domain.operationalProjectId !== operationalProjectId) {
    throw AppError.badRequest('المجال المختار لا يتبع مشروع الدورة', 'serverErrors.course.domainProjectMismatch');
  }
  return domain.id;
}

/** يُنجز عنصر «تأكيد نوع الشهادة» حين يؤكَّد النوع — لا يحتاج اعتماداً، فهو إثبات واقعة */
async function completeConfirmationElement(courseId, userId, now = new Date()) {
  return prisma.courseClosureTracking.updateMany({
    where: {
      courseId,
      element: { key: ELEMENT_KEY },
      status: { in: ['NOT_STARTED', 'RETURNED', 'REJECTED', 'PENDING_APPROVAL'] },
    },
    data: { status: 'APPROVED', executionAt: now, executedById: userId, decisionAt: now, decidedById: userId },
  });
}

module.exports = {
  TYPES, CONFIRMED, LABELS, ELEMENT_KEY,
  isConfirmed, testFlagsFor, transition, createFields,
  resolveDomain, completeConfirmationElement,
};
