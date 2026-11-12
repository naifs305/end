// =============================================================
// فترات إيقاف عناصر الإقفال — قرار مؤسسي بتاريخ
// -------------------------------------------------------------
// مثال حيّ: أُوقف إصدار التأمين الطبي فترةً ثم أُعيد، وقد يتكرر.
// الحل ليس مفتاحاً بيد المنسق — ذلك باب مفتوح للتخلّص من العمل،
// ويفقدنا معرفة هل أُصدر التأمين أم لا. ولا هو تعطيل العنصر من
// الكتالوج — فذلك يسري على الدورات الجديدة وحدها، وتبقى الدورات
// المفتوحة مطالَبة به ويُخصم على منسقيها.
//
// الحل: فترة بتاريخ يسجّلها المدير. كل دورة تبدأ داخلها يسقط عنها
// العنصر تلقائياً ولا يُحتسب، والدورات المفتوحة تُحدَّث معها.
// والمنسق لا يفعل شيئاً — فلا نسيان ولا خطأ ولا تلاعب.
// =============================================================
const prisma = require('../../db/prisma');
const { AppError } = require('../../shared/AppError');
const audit = require('../../services/audit');

const logAudit = (...args) => audit.logAudit(...args);

// الدورات المفتوحة فقط — لا نمسّ المغلقة ولا المؤرشفة
const OPEN_COURSE_STATUSES = ['PREPARATION', 'EXECUTION', 'AWAITING_CLOSURE'];

function overlapWhere(startsAt, endsAt) {
  // الدورة تقع داخل الفترة إذا كانت بدايتها بين طرفيها
  return endsAt
    ? { startDate: { gte: startsAt, lte: endsAt } }
    : { startDate: { gte: startsAt } };
}

/**
 * هل تقع الدورة داخل فترة إيقاف سارية لهذا العنصر؟
 * تُستدعى عند إنشاء الدورة وعند إعادة تقييم العناصر المشروطة.
 */
async function findActiveSuspensionFor(elementId, courseStartDate, tx) {
  const db = tx || prisma;
  const start = new Date(courseStartDate);
  return db.elementSuspension.findFirst({
    where: {
      elementId,
      isActive: true,
      startsAt: { lte: start },
      OR: [{ endsAt: null }, { endsAt: { gte: start } }],
    },
    orderBy: { startsAt: 'desc' },
  });
}

/** كل فترات الإيقاف السارية — تُحمَّل مرة واحدة عند إنشاء الدورة */
async function findAllActiveSuspensions(tx) {
  const db = tx || prisma;
  return db.elementSuspension.findMany({ where: { isActive: true } });
}

function suspensionCoversDate(suspension, date) {
  const d = new Date(date);
  if (new Date(suspension.startsAt) > d) return false;
  if (suspension.endsAt && new Date(suspension.endsAt) < d) return false;
  return true;
}

async function listSuspensions(elementId) {
  return prisma.elementSuspension.findMany({
    where: elementId ? { elementId } : undefined,
    include: {
      element: { select: { id: true, key: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { trackings: true } },
    },
    orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }],
  });
}

/**
 * فتح فترة إيقاف — وتطبيقها فوراً على الدورات المفتوحة.
 * هذا ما كان ناقصاً: تعطيل العنصر لم يكن يمسّ الدورات القائمة.
 */
async function createSuspension(dto, user, activeRole) {
  const element = await prisma.closureElement.findUnique({ where: { id: dto.elementId } });
  if (!element) {
    throw AppError.notFound('العنصر غير موجود', 'serverErrors.closureElements.notFound');
  }

  const startsAt = new Date(dto.startsAt);
  const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;

  if (Number.isNaN(startsAt.getTime())) {
    throw AppError.badRequest('تاريخ بداية الإيقاف غير صحيح', 'serverErrors.suspensions.invalidStart');
  }
  if (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt < startsAt)) {
    throw AppError.badRequest('تاريخ نهاية الإيقاف يجب أن يكون بعد بدايته', 'serverErrors.suspensions.invalidEnd');
  }

  const overlapping = await prisma.elementSuspension.findFirst({
    where: {
      elementId: dto.elementId,
      isActive: true,
      OR: [
        { endsAt: null },
        { endsAt: { gte: startsAt } },
      ],
    },
  });
  if (overlapping) {
    throw AppError.badRequest(
      'توجد فترة إيقاف سارية لهذا العنصر — أغلقها أولاً',
      'serverErrors.suspensions.overlapping',
    );
  }

  const suspension = await prisma.elementSuspension.create({
    data: {
      elementId: dto.elementId,
      startsAt,
      endsAt,
      reason: String(dto.reason).trim(),
      isActive: true,
      createdById: user.id,
    },
  });

  const applied = await applySuspensionToOpenCourses(suspension);

  await logAudit(user.id, activeRole, 'ELEMENT_SUSPENSION_CREATED', {
    suspensionId: suspension.id,
    elementId: element.id,
    elementName: element.name,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    reason: suspension.reason,
    affectedCourses: applied,
  }, null);

  return { ...suspension, affectedCourses: applied };
}

/**
 * إسقاط العنصر عن كل دورة مفتوحة تقع داخل الفترة.
 * لا نمسّ عنصراً مُعتمداً (عمل أُنجز فعلاً) ولا عنصراً أعفاه المدير
 * بقراره — نُعلّم ما نُسقطه بمرجع الفترة لنعيده وحده عند انتهائها.
 */
async function applySuspensionToOpenCourses(suspension) {
  const courses = await prisma.course.findMany({
    where: {
      status: { in: OPEN_COURSE_STATUSES },
      ...overlapWhere(suspension.startsAt, suspension.endsAt),
    },
    select: { id: true },
  });

  if (!courses.length) return 0;

  const result = await prisma.courseClosureTracking.updateMany({
    where: {
      courseId: { in: courses.map((c) => c.id) },
      elementId: suspension.elementId,
      status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] },
    },
    data: {
      status: 'NOT_APPLICABLE',
      suspensionId: suspension.id,
    },
  });

  return result.count;
}

/**
 * إغلاق فترة الإيقاف — عاد العنصر.
 * نُعيد ما أسقطناه نحن فقط (بمرجع الفترة) في الدورات التي ما زالت
 * مفتوحة، ولا نمسّ ما أعفاه المدير بقراره ولا ما اعتُمد.
 */
async function closeSuspension(id, dto, user, activeRole) {
  const suspension = await prisma.elementSuspension.findUnique({
    where: { id },
    include: { element: { select: { id: true, name: true } } },
  });

  if (!suspension) {
    throw AppError.notFound('فترة الإيقاف غير موجودة', 'serverErrors.suspensions.notFound');
  }
  if (!suspension.isActive) {
    throw AppError.badRequest('فترة الإيقاف مغلقة بالفعل', 'serverErrors.suspensions.alreadyClosed');
  }

  const endsAt = dto?.endsAt ? new Date(dto.endsAt) : new Date();
  if (Number.isNaN(endsAt.getTime()) || endsAt < new Date(suspension.startsAt)) {
    throw AppError.badRequest('تاريخ الإغلاق غير صحيح', 'serverErrors.suspensions.invalidEnd');
  }

  const updated = await prisma.elementSuspension.update({
    where: { id },
    data: { isActive: false, endsAt },
  });

  // الدورات التي بدأت بعد نهاية الفترة يعود إليها العنصر
  const restored = await prisma.courseClosureTracking.updateMany({
    where: {
      suspensionId: id,
      status: 'NOT_APPLICABLE',
      course: {
        status: { in: OPEN_COURSE_STATUSES },
        startDate: { gt: endsAt },
      },
    },
    data: { status: 'NOT_STARTED', suspensionId: null },
  });

  await logAudit(user.id, activeRole, 'ELEMENT_SUSPENSION_CLOSED', {
    suspensionId: id,
    elementName: suspension.element?.name,
    endsAt: endsAt.toISOString(),
    restoredCourses: restored.count,
  }, null);

  return { ...updated, restoredCourses: restored.count };
}

module.exports = {
  OPEN_COURSE_STATUSES,
  findActiveSuspensionFor,
  findAllActiveSuspensions,
  suspensionCoversDate,
  listSuspensions,
  createSuspension,
  applySuspensionToOpenCourses,
  closeSuspension,
};
