// ======================================================================
// مراجعة الشهادات بعين ثانية — شرط لتقديم عنصر «إصدار الشهادات»
// ----------------------------------------------------------------------
// لا يُقدَّم العنصر حتى يُسند المنسق مراجعة الشهادات لمنسق آخر، ويؤكد
// المراجِع أنه راجعها. وإن وجد ملاحظات أعادها بها، فيصحح المنسق ثم يعيد
// إرسالها للمراجعة. ويتحقق الخادم من التأكيد عند التقديم.
//
// formData.certReview = {
//   status: 'ASSIGNED' | 'CONFIRMED' | 'RETURNED',
//   reviewerId, reviewerName, assignedById, assignedAt, link, note,
//   respondedAt, reviewerNote, rounds
// }
// ======================================================================
const repo = require('../closure/closure.repo');
const permissions = require('../../services/permissions');
const prisma = require('../../db/prisma');

const ELEMENT_KEY = 'certificates';
const LOCKED = ['APPROVED', 'PENDING_APPROVAL', 'NOT_APPLICABLE'];

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const fullName = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

/** رابط http(s) صالح، وإلا فارغ */
function cleanUrl(v) {
  const s = str(v, 600);
  if (!s) return '';
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

/** هل اكتملت المراجعة؟ — يستدعيه التقديم */
function isConfirmed(formData) {
  return formData?.certReview?.status === 'CONFIRMED' && !!formData.certReview.respondedAt;
}

async function load(trackingId) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);
  if (!item) throw httpError(404, 'العنصر غير موجود', 'serverErrors.closureElements.notFound');
  if (item.element.key !== ELEMENT_KEY) throw httpError(400, 'هذا العنصر ليس إصدار الشهادات', 'serverErrors.certReview.notCertificates');
  return item;
}

async function notify(userId, title, message, course) {
  try {
    const { createNotification } = require('../../services/notifications');
    await createNotification(userId, 'CERT_REVIEW', title, message, { courseId: course.id, courseName: course.name });
  } catch { /* الإشعار لا يعطّل العمل */ }
}

/** المراجِعون المتاحون: منسقون نشطون غير منسق الدورة ومن يُسند */
async function candidates(course, user) {
  const rows = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' }, id: { notIn: [course.primaryEmployeeId, user.id].filter(Boolean) } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return rows.map((u) => ({ id: u.id, name: fullName(u) }));
}

async function get(trackingId, user, activeRole) {
  const item = await load(trackingId);
  const review = item.formData?.certReview || null;
  const isReviewer = !!review && review.reviewerId === user.id;
  if (!isReviewer && !(await permissions.canViewCourse(user, activeRole, item.course))) {
    throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  }
  const canAssign = !LOCKED.includes(item.status) && await permissions.canSubmitElement(user, activeRole, item.course);
  return {
    review,
    canAssign,
    isReviewer,
    canRespond: isReviewer && review.status === 'ASSIGNED',
    candidates: canAssign ? await candidates(item.course, user) : [],
    course: { id: item.course.id, name: item.course.name },
  };
}

/** إسناد المراجعة (أو إعادة إرسالها بعد التصحيح) */
async function assign(trackingId, dto, user, activeRole) {
  const item = await load(trackingId);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }
  if (LOCKED.includes(item.status)) throw httpError(400, 'العنصر مُقدَّم أو غير منطبق — لا تُسند مراجعته', 'serverErrors.certReview.locked');
  const reviewerId = String(dto?.reviewerId || '');
  if (!reviewerId) throw httpError(400, 'اختر المنسق المراجِع', 'serverErrors.certReview.reviewerRequired');
  if (reviewerId === user.id || reviewerId === item.course.primaryEmployeeId) {
    throw httpError(400, 'المراجِع منسق آخر غير منسق الدورة', 'serverErrors.certReview.selfReview');
  }
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true, firstName: true, lastName: true, isActive: true, roles: true } });
  if (!reviewer || !reviewer.isActive || !reviewer.roles.includes('EMPLOYEE')) {
    throw httpError(400, 'المراجِع يجب أن يكون منسقاً نشطاً', 'serverErrors.certReview.reviewerInvalid');
  }
  if (dto?.link && !cleanUrl(dto.link)) throw httpError(400, 'رابط الشهادات غير صالح — يبدأ بـ https://', 'serverErrors.certReview.badLink');

  const previous = item.formData?.certReview || {};
  const review = {
    status: 'ASSIGNED',
    reviewerId: reviewer.id,
    reviewerName: fullName(reviewer),
    assignedById: user.id,
    assignedAt: new Date().toISOString(),
    link: cleanUrl(dto?.link),
    note: str(dto?.note, 600),
    respondedAt: null,
    reviewerNote: previous.status === 'RETURNED' ? previous.reviewerNote : null,
    rounds: (previous.rounds || 0) + 1,
  };
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certReview: review } },
  });
  await notify(
    reviewer.id,
    `📝 مراجعة شهادات دورة «${item.course.name}»`,
    `طلب منك ${fullName(user) || 'زميلك'} مراجعة شهادات الدورة قبل تقديمها. افتح الدورة وأكّد المراجعة أو أعدها بملاحظاتك.`,
    item.course,
  );
  return { review };
}

/** رد المراجِع: تأكيد المراجعة، أو إعادتها بملاحظات */
async function respond(trackingId, dto, user) {
  const item = await load(trackingId);
  const review = item.formData?.certReview;
  if (!review || review.reviewerId !== user.id) throw httpError(403, 'لست المراجِع المسند لهذه الشهادات', 'serverErrors.certReview.notReviewer');
  if (review.status !== 'ASSIGNED') throw httpError(400, 'لا توجد مراجعة بانتظارك على هذه الشهادات', 'serverErrors.certReview.notPending');
  const decision = dto?.decision === 'return' ? 'RETURNED' : dto?.decision === 'confirm' ? 'CONFIRMED' : null;
  if (!decision) throw httpError(400, 'اختر: تأكيد المراجعة أو إعادتها بملاحظات', 'serverErrors.certReview.badDecision');
  const note = str(dto?.note, 1000);
  if (decision === 'RETURNED' && note.length < 3) throw httpError(400, 'اكتب الملاحظات التي يصححها المنسق', 'serverErrors.certReview.noteRequired');

  const next = { ...review, status: decision, respondedAt: new Date().toISOString(), reviewerNote: note || null };
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certReview: next } },
  });
  const owner = review.assignedById || item.course.primaryEmployeeId;
  await notify(
    owner,
    decision === 'CONFIRMED' ? `✅ رُوجعت شهادات «${item.course.name}»` : `↩️ ملاحظات على شهادات «${item.course.name}»`,
    decision === 'CONFIRMED'
      ? `أكّد ${review.reviewerName} مراجعة الشهادات — يمكنك الآن تقديم عنصر «إصدار الشهادات».`
      : `أعاد ${review.reviewerName} الشهادات بملاحظات: ${note}. صحّحها ثم أعد إرسالها للمراجعة.`,
    item.course,
  );
  return { review: next };
}

/** المراجعات التي تنتظر المستخدم — لبطاقة لوحة التحكم */
async function mine(user) {
  const rows = await prisma.courseClosureTracking.findMany({
    where: {
      element: { key: ELEMENT_KEY },
      formData: { path: ['certReview', 'reviewerId'], equals: user.id },
    },
    select: { id: true, formData: true, course: { select: { id: true, name: true, endDate: true } } },
    take: 50,
  });
  return rows
    .filter((r) => r.formData?.certReview?.status === 'ASSIGNED')
    .map((r) => ({
      trackingId: r.id,
      courseId: r.course.id,
      courseName: r.course.name,
      endDate: r.course.endDate,
      assignedAt: r.formData.certReview.assignedAt,
      link: r.formData.certReview.link || '',
    }));
}

module.exports = { ELEMENT_KEY, isConfirmed, cleanUrl, get, assign, respond, mine };
