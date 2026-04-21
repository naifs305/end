// =============================================================
// خدمة الإقفال المحدّثة (تدعم الأدوار الثلاثة)
// =============================================================

const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const permissions = require('./permissions');

// ---- تحقق نموذج تقرير الافتتاح ----
function validateOpeningReport(dto) {
  const required = [
    dto.training_environment,
    dto.initial_readiness,
    dto.trainee_attendance,
  ];

  for (const section of required) {
    if (!section?.rating) {
      const err = new Error('لا يمكن تقديم التقرير قبل استكمال الحقول الإلزامية');
      err.statusCode = 400;
      throw err;
    }
    if (
      ['needs_improvement', 'weak', 'requires_development'].includes(section.rating) &&
      (!section.comment || section.comment.trim() === '')
    ) {
      const err = new Error('يوجد تقييم يتطلب إدخال ملاحظة تفسيرية إلزامية');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!dto.declarationConfirmed) {
    const err = new Error('يجب الإقرار بصحة البيانات قبل تقديم التقرير');
    err.statusCode = 400;
    throw err;
  }
}

// ---- تحقق نموذج تقرير الاختتام (النموذج الأصلي) ----
function validateClosingReport(dto) {
  const requiredSections = [
    dto.training_environment,
    dto.trainer_evaluation,
    dto.lms_content_evaluation,
    dto.trainee_evaluation,
    dto.program_evaluation,
  ];

  for (const section of requiredSections) {
    if (!section?.rating) {
      const err = new Error('لا يمكن تقديم التقرير قبل استكمال الحقول الإلزامية');
      err.statusCode = 400;
      throw err;
    }
    if (
      ['needs_improvement', 'weak', 'requires_development'].includes(section.rating) &&
      (!section.comment || section.comment.trim() === '')
    ) {
      const err = new Error('يوجد تقييم يتطلب إدخال ملاحظة تفسيرية إلزامية');
      err.statusCode = 400;
      throw err;
    }
  }

  if (!dto.declarationConfirmed) {
    const err = new Error('يجب الإقرار بصحة البيانات قبل تقديم التقرير');
    err.statusCode = 400;
    throw err;
  }

  if (dto.attachments && dto.attachments.length > 6) {
    const err = new Error('الحد الأقصى للصور الداعمة هو 6 صور');
    err.statusCode = 400;
    throw err;
  }
}

function validateAdvance(dto) {
  if (
    dto.totalAmount === undefined || dto.totalAmount === null || dto.totalAmount < 0 ||
    !dto.requestDate || !dto.receiptDate
  ) {
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

// --- فحص إقفال الدورة التلقائي ---
async function checkCourseClosure(courseId) {
  const elements = await prisma.courseClosureTracking.findMany({
    where: { courseId },
  });

  const allClosed = elements.every(
    (el) => el.status === 'APPROVED' || el.status === 'NOT_APPLICABLE',
  );

  if (allClosed) {
    await prisma.course.update({
      where: { id: courseId },
      data: { status: 'CLOSED' },
    });
    await logAudit('system', 'SYSTEM', 'COURSE_CLOSED', {}, courseId);
  }
}

// --- تحديث حالة عنصر إقفال (كل المنطق) ---
async function updateStatus(trackingId, data, user, activeRole) {
  const item = await prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element: true,
      course: { include: { supportingTeam: true } },
    },
  });

  if (!item) {
    const err = new Error('العنصر غير موجود');
    err.statusCode = 404;
    throw err;
  }

  // --- أفعال «تقديم» و«سحب» (خاصة بالمنفّذ — موظف/مشرف/مدير مُسندة له الدورة) ---
  if (data.status === 'PENDING_APPROVAL' || data.status === 'NOT_STARTED') {
    const canSubmit = await permissions.canSubmitElement(user, item.course);
    if (!canSubmit) {
      const err = new Error('غير مصرح لك بتعديل عناصر هذه الدورة');
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
          rejectionReason: null,
          decisionAt: null,
          decidedById: null,
        },
      });

      await logAudit(
        user.id, activeRole, 'ELEMENT_SUBMITTED',
        { element: item.element.name, status: 'PENDING_APPROVAL' },
        item.courseId,
      );
      return result;
    }

    if (data.status === 'NOT_STARTED') {
      if (item.status !== 'PENDING_APPROVAL' && item.status !== 'RETURNED') {
        const err = new Error('لا يمكن سحب العنصر في حالته الحالية');
        err.statusCode = 400;
        throw err;
      }

      const result = await prisma.courseClosureTracking.update({
        where: { id: trackingId },
        data: {
          status: 'NOT_STARTED',
          decisionAt: null,
          decidedById: null,
          rejectionReason: null,
        },
      });

      await logAudit(
        user.id, activeRole, 'ELEMENT_WITHDRAWN',
        { element: item.element.name, status: 'NOT_STARTED' },
        item.courseId,
      );
      return result;
    }
  }

  // --- أفعال «اعتماد/رفض/إعادة» (المدير + مشرف المشروع) ---
  if (['APPROVED', 'REJECTED', 'RETURNED'].includes(data.status)) {
    const canDecide = await permissions.canDecideElement(user, activeRole, item.course);
    if (!canDecide) {
      const err = new Error('لا تملك صلاحية اتخاذ قرار على هذا العنصر');
      err.statusCode = 403;
      throw err;
    }

    if (item.status !== 'PENDING_APPROVAL') {
      const err = new Error('العنصر ليس بانتظار الاعتماد');
      err.statusCode = 400;
      throw err;
    }

    const reason =
      data.status === 'REJECTED' || data.status === 'RETURNED'
        ? (data.notes || '').trim()
        : null;

    if ((data.status === 'REJECTED' || data.status === 'RETURNED') && !reason) {
      const err = new Error('يجب كتابة سبب الرفض أو الإعادة');
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

    const actionMap = {
      APPROVED: 'ELEMENT_APPROVED',
      RETURNED: 'ELEMENT_RETURNED',
      REJECTED: 'ELEMENT_REJECTED',
    };

    await logAudit(
      user.id, activeRole, actionMap[data.status],
      { element: item.element.name, status: data.status, notes: reason },
      item.courseId,
    );

    await checkCourseClosure(item.courseId);
    return result;
  }

  const err = new Error('حالة غير صحيحة');
  err.statusCode = 400;
  throw err;
}

async function submitOpeningReport(trackingId, dto, user, activeRole) {
  validateOpeningReport(dto);
  return updateStatus(trackingId, {
    status: 'PENDING_APPROVAL',
    formData: dto,
    notes: 'تم تقديم تقرير افتتاح الدورة',
  }, user, activeRole);
}

async function submitClosingReport(trackingId, dto, user, activeRole) {
  validateClosingReport(dto);
  return updateStatus(trackingId, {
    status: 'PENDING_APPROVAL',
    formData: dto,
    notes: 'تم تقديم تقرير اختتام الدورة',
  }, user, activeRole);
}

async function submitAdvance(trackingId, dto, user, activeRole) {
  validateAdvance(dto);
  return updateStatus(trackingId, {
    status: 'PENDING_APPROVAL',
    formData: dto,
    notes: 'تم تقديم طلب السلفة',
  }, user, activeRole);
}

async function submitSettlement(trackingId, dto, user, activeRole) {
  validateSettlement(dto);
  return updateStatus(trackingId, {
    status: 'PENDING_APPROVAL',
    formData: dto,
    notes: 'تم تقديم التسوية',
  }, user, activeRole);
}

async function getElementDetails(id) {
  return prisma.courseClosureTracking.findUnique({
    where: { id },
    include: { course: { include: { operationalProject: true, primaryEmployee: true } }, element: true },
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
