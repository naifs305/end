const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const permissions = require('./permissions');

function requireCommentWhenWeak(section) {
  if (!section?.rating) return false;
  return ['needs_improvement', 'weak', 'requires_development'].includes(section.rating)
    && (!section.comment || !section.comment.trim());
}

function normalizeReportDto(dto = {}) {
  const normalized = { ...dto };

  if (normalized.lms_content_evaluation && !normalized.lms_evaluation) {
    normalized.lms_evaluation = normalized.lms_content_evaluation;
  }

  if (normalized.lms_content_evaluation && !normalized.content_evaluation) {
    normalized.content_evaluation = normalized.lms_content_evaluation;
  }

  return normalized;
}

function validateSections(required, messagePrefix) {
  for (const section of required) {
    if (!section?.rating) {
      const err = new Error(`${messagePrefix} غير مكتملة`);
      err.statusCode = 400;
      throw err;
    }
    if (requireCommentWhenWeak(section)) {
      const err = new Error(`يوجد تقييم في ${messagePrefix} يحتاج ملاحظة إلزامية`);
      err.statusCode = 400;
      throw err;
    }
  }
}

function validateOpeningReport(dto) {
  const normalized = normalizeReportDto(dto);
  const required = [
    normalized.training_environment,
    normalized.trainer_evaluation,
    normalized.trainee_evaluation,
    normalized.content_evaluation,
    normalized.lms_evaluation,
    normalized.support_services_evaluation,
  ];
  validateSections(required, 'تقرير الافتتاح');
  if (!normalized.declarationConfirmed) {
    const err = new Error('يجب تأكيد الإقرار قبل تقديم تقرير الافتتاح');
    err.statusCode = 400;
    throw err;
  }
}

function validateClosingReport(dto) {
  const normalized = normalizeReportDto(dto);
  const required = [
    normalized.training_environment,
    normalized.trainer_evaluation,
    normalized.trainee_evaluation,
    normalized.content_evaluation,
    normalized.lms_evaluation,
    normalized.support_services_evaluation,
  ];
  validateSections(required, 'تقرير الاختتام');
  if (!normalized.declarationConfirmed) {
    const err = new Error('يجب تأكيد الإقرار قبل تقديم تقرير الاختتام');
    err.statusCode = 400;
    throw err;
  }
}

function validateAdvance(dto) {
  if (dto.totalAmount === undefined || dto.totalAmount === null || dto.totalAmount < 0 || !dto.requestDate || !dto.receiptDate) {
    const err = new Error('بيانات طلب السلفة غير مكتملة');
    err.statusCode = 400;
    throw err;
  }
}

function validateSettlement(dto) {
  if (
    dto.advanceAmount === undefined || dto.advanceAmount === null || dto.advanceAmount < 0 ||
    dto.spentAmount === undefined || dto.spentAmount === null || dto.spentAmount < 0 ||
    !dto.deliveredToAuditorDate || !dto.invoicesUploadedDate
  ) {
    const err = new Error('بيانات تسوية السلفة غير مكتملة');
    err.statusCode = 400;
    throw err;
  }
}

async function checkCourseClosure(courseId) {
  const elements = await prisma.courseClosureTracking.findMany({ where: { courseId } });
  const allClosed = elements.every((item) => ['APPROVED', 'NOT_APPLICABLE'].includes(item.status));

  if (allClosed) {
    await prisma.course.update({ where: { id: courseId }, data: { status: 'CLOSED' } });
    await logAudit('system', 'SYSTEM', 'COURSE_CLOSED', {}, courseId);
  }
}

async function updateStatus(trackingId, data, user, activeRole) {
  const item = await prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element: true,
      course: { include: { supportingTeam: true } },
    },
  });

  if (!item) {
    const err = new Error('عنصر الإقفال غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (['PENDING_APPROVAL', 'NOT_STARTED'].includes(data.status)) {
    const allowed = await permissions.canSubmitElement(user, activeRole, item.course);
    if (!allowed) {
      const err = new Error('لا تملك صلاحية تنفيذ هذا العنصر');
      err.statusCode = 403;
      throw err;
    }

    if (data.status === 'PENDING_APPROVAL') {
      const result = await prisma.courseClosureTracking.update({
        where: { id: trackingId },
        data: {
          status: 'PENDING_APPROVAL',
          formData: data.formData ?? item.formData,
          notes: data.notes ?? item.notes,
          executionAt: new Date(),
          executedById: user.id,
          decisionAt: null,
          decidedById: null,
          rejectionReason: null,
        },
      });

      await logAudit(user.id, activeRole, 'ELEMENT_SUBMITTED', {
        elementKey: item.element.key,
        elementName: item.element.name,
      }, item.courseId);

      return result;
    }

    if (!['PENDING_APPROVAL', 'RETURNED'].includes(item.status)) {
      const err = new Error('لا يمكن سحب العنصر في حالته الحالية');
      err.statusCode = 400;
      throw err;
    }

    return prisma.courseClosureTracking.update({
      where: { id: trackingId },
      data: {
        status: 'NOT_STARTED',
        decisionAt: null,
        decidedById: null,
        rejectionReason: null,
      },
    });
  }

  if (['APPROVED', 'REJECTED', 'RETURNED'].includes(data.status)) {
    const allowed = await permissions.canDecideElement(user, activeRole, item.course);
    if (!allowed) {
      const err = new Error('لا تملك صلاحية اعتماد أو رفض هذا العنصر');
      err.statusCode = 403;
      throw err;
    }

    if (item.status !== 'PENDING_APPROVAL') {
      const err = new Error('العنصر ليس بانتظار قرار');
      err.statusCode = 400;
      throw err;
    }

    const reason = ['REJECTED', 'RETURNED'].includes(data.status) ? String(data.notes || '').trim() : null;
    if (['REJECTED', 'RETURNED'].includes(data.status) && !reason) {
      const err = new Error('سبب الإعادة أو الرفض مطلوب');
      err.statusCode = 400;
      throw err;
    }

    const result = await prisma.courseClosureTracking.update({
      where: { id: trackingId },
      data: {
        status: data.status,
        decisionAt: new Date(),
        decidedById: user.id,
        notes: reason,
        rejectionReason: reason,
      },
    });

    await logAudit(user.id, activeRole, `ELEMENT_${data.status}`, {
      elementKey: item.element.key,
      elementName: item.element.name,
      notes: reason,
    }, item.courseId);

    await checkCourseClosure(item.courseId);
    return result;
  }

  const err = new Error('الحالة المرسلة غير صحيحة');
  err.statusCode = 400;
  throw err;
}

async function submitOpeningReport(trackingId, dto, user, activeRole) {
  const normalized = normalizeReportDto(dto);
  validateOpeningReport(normalized);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: normalized, notes: 'تم تقديم تقرير الافتتاح' }, user, activeRole);
}

async function submitClosingReport(trackingId, dto, user, activeRole) {
  const normalized = normalizeReportDto(dto);
  validateClosingReport(normalized);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: normalized, notes: 'تم تقديم تقرير الاختتام' }, user, activeRole);
}

async function submitAdvance(trackingId, dto, user, activeRole) {
  validateAdvance(dto);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: dto, notes: 'تم تقديم طلب السلفة' }, user, activeRole);
}

async function submitSettlement(trackingId, dto, user, activeRole) {
  validateSettlement(dto);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: dto, notes: 'تم تقديم التسوية' }, user, activeRole);
}

async function getElementDetails(id) {
  return prisma.courseClosureTracking.findUnique({
    where: { id },
    include: {
      course: { include: { operationalProject: true, primaryEmployee: true } },
      element: true,
    },
  });
}

module.exports = {
  updateStatus,
  submitOpeningReport,
  submitClosingReport,
  submitAdvance,
  submitSettlement,
  getElementDetails,
  checkCourseClosure,
};
