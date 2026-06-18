// =============================================================
// وحدة الإقفال — حالات الاستخدام (Service)
// آلة حالة عناصر الإقفال + التحديثات الذرّية + فصل المهام + التقارير.
// المنطق منقول حرفياً من lib/services/closure.js مع إبقاء جميع
// الحُرّاس ورموز الأخطاء وآثار التدقيق/الإشعارات/البريد كما هي.
// =============================================================
const repo = require('./closure.repo');
const audit = require('../../services/audit');
const permissions = require('../../services/permissions');
const notifications = require('../../services/notifications');
const emailService = require('../../services/emailService');

// مراجع غير مفكَّكة (non-destructured) حتى يبقى الاستدعاء عبر الكائن
// المشترك — يحافظ على السلوك ويسمح للاختبارات بالتجسّس على الدوال.
const logAudit = (...args) => audit.logAudit(...args);
const createNotification = (...args) => notifications.createNotification(...args);

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
  const elements = await repo.findTrackingByCourse(courseId);
  const allClosed = elements.every((item) => ['APPROVED', 'NOT_APPLICABLE'].includes(item.status));

  if (allClosed) {
    await repo.setCourseStatus(courseId, 'CLOSED');
    await logAudit('system', 'SYSTEM', 'COURSE_CLOSED', {}, courseId);
  }
}

async function updateStatus(trackingId, data, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);

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
      // يمكن التقديم فقط من حالة NOT_STARTED أو RETURNED
      if (!['NOT_STARTED', 'RETURNED'].includes(item.status)) {
        const err = new Error(
          item.status === 'APPROVED'
            ? 'العنصر مُعتمد بالفعل ولا يمكن إعادة تقديمه'
            : 'لا يمكن تقديم العنصر في حالته الحالية'
        );
        err.statusCode = 400;
        throw err;
      }

      // تحديث ذرّي: يُسمح بالتقديم فقط إذا كانت الحالة لا تزال NOT_STARTED أو RETURNED
      const submitResult = await repo.updateManyByStatus(trackingId, { in: ['NOT_STARTED', 'RETURNED'] }, {
        status: 'PENDING_APPROVAL',
        formData: data.formData ?? item.formData,
        notes: data.notes ?? item.notes,
        executionAt: new Date(),
        executedById: user.id,
        decisionAt: null,
        decidedById: null,
        rejectionReason: null,
        // مبرر التأخر (اختياري — يظهر للمشرف والمدير)
        ...(data.delayReason?.trim() ? { delayReason: data.delayReason.trim() } : {}),
      });

      if (submitResult.count === 0) {
        const err = new Error('تغيّرت حالة العنصر، يرجى إعادة المحاولة');
        err.statusCode = 409;
        throw err;
      }

      await logAudit(user.id, activeRole, 'ELEMENT_SUBMITTED', {
        elementKey: item.element.key,
        elementName: item.element.name,
      }, item.courseId);

      return repo.findTrackingById(trackingId);
    }

    if (!['PENDING_APPROVAL', 'RETURNED'].includes(item.status)) {
      const err = new Error('لا يمكن سحب العنصر في حالته الحالية');
      err.statusCode = 400;
      throw err;
    }

    // سحب ذرّي: يُسمح بالسحب فقط من PENDING_APPROVAL أو RETURNED
    const withdrawResult = await repo.updateManyByStatus(trackingId, { in: ['PENDING_APPROVAL', 'RETURNED'] }, {
      status: 'NOT_STARTED',
      decisionAt: null,
      decidedById: null,
      rejectionReason: null,
    });

    if (withdrawResult.count === 0) {
      const err = new Error('تغيّرت حالة العنصر، يرجى إعادة المحاولة');
      err.statusCode = 409;
      throw err;
    }

    await logAudit(user.id, activeRole, 'ELEMENT_WITHDRAWN', {
      elementKey: item.element.key,
      elementName: item.element.name,
    }, item.courseId);

    return repo.findTrackingById(trackingId);
  }

  if (['APPROVED', 'REJECTED', 'RETURNED'].includes(data.status)) {
    const allowed = await permissions.canDecideElement(user, activeRole, item.course);
    if (!allowed) {
      const err = new Error('لا تملك صلاحية اعتماد أو رفض هذا العنصر');
      err.statusCode = 403;
      throw err;
    }

    // فصل المهام: لا يجوز للمنفِّذ أن يكون هو المُعتمِد لنفس العنصر
    if (item.executedById && item.executedById === user.id) {
      const err = new Error('لا يمكنك اعتماد أو رفض عنصر قمت بتنفيذه (يلزم فصل المهام)');
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

    // قرار ذرّي: يُسمح بالاعتماد/الرفض/الإعادة فقط إذا كان لا يزال PENDING_APPROVAL
    const decideResult = await repo.updateManyByStatus(trackingId, 'PENDING_APPROVAL', {
      status: data.status,
      decisionAt: new Date(),
      decidedById: user.id,
      notes: reason,
      rejectionReason: reason,
    });

    if (decideResult.count === 0) {
      const err = new Error('تغيّرت حالة العنصر، يرجى إعادة المحاولة');
      err.statusCode = 409;
      throw err;
    }

    const result = await repo.findTrackingById(trackingId);

    await logAudit(user.id, activeRole, `ELEMENT_${data.status}`, {
      elementKey: item.element.key,
      elementName: item.element.name,
      notes: reason,
    }, item.courseId);

    // إشعار فوري للموظف عند الإعادة أو الرفض
    if (data.status === 'RETURNED') {
      await createNotification(
        item.course.primaryEmployeeId,
        'ELEMENT_RETURNED',
        `طلب مراجعة: ${item.element.name}`,
        `أُعيد العنصر "${item.element.name}" في الدورة "${item.course.name}". السبب: ${reason}. يُرجى التصحيح وإعادة التقديم خلال 48 ساعة.`,
        { trackingId, courseId: item.courseId, elementKey: item.element.key, elementName: item.element.name },
      );
      // بريد إلكتروني فوري
      emailService.sendElementReturnedEmail({
        employeeId: item.course.primaryEmployeeId,
        courseName: item.course.name,
        elementName: item.element.name,
        reason,
        courseId: item.courseId,
      }).catch(() => {});
    }

    if (data.status === 'REJECTED') {
      await createNotification(
        item.course.primaryEmployeeId,
        'ELEMENT_REJECTED',
        `رفض تقديم: ${item.element.name}`,
        `رُفض تقديمك لـ "${item.element.name}" في الدورة "${item.course.name}". السبب: ${reason}.`,
        { trackingId, courseId: item.courseId, elementKey: item.element.key, elementName: item.element.name },
      );
      // بريد إلكتروني فوري
      emailService.sendElementRejectedEmail({
        employeeId: item.course.primaryEmployeeId,
        courseName: item.course.name,
        elementName: item.element.name,
        reason,
        courseId: item.courseId,
      }).catch(() => {});
    }

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
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: normalized, notes: 'تم تقديم تقرير الافتتاح', delayReason: dto.delayReason }, user, activeRole);
}

async function submitClosingReport(trackingId, dto, user, activeRole) {
  const normalized = normalizeReportDto(dto);
  validateClosingReport(normalized);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: normalized, notes: 'تم تقديم تقرير الاختتام', delayReason: dto.delayReason }, user, activeRole);
}

async function submitAdvance(trackingId, dto, user, activeRole) {
  validateAdvance(dto);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: dto, notes: 'تم تقديم طلب السلفة' }, user, activeRole);
}

async function submitSettlement(trackingId, dto, user, activeRole) {
  validateSettlement(dto);
  return updateStatus(trackingId, { status: 'PENDING_APPROVAL', formData: dto, notes: 'تم تقديم التسوية' }, user, activeRole);
}

async function approveFinancialElementDirectly(trackingId, data, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);

  if (!item) {
    const err = new Error('عنصر الإقفال غير موجود');
    err.statusCode = 404;
    throw err;
  }

  if (!['advance_req', 'settlement'].includes(item.element.key)) {
    const err = new Error('الإقفال المباشر متاح لعناصر السلف فقط');
    err.statusCode = 400;
    throw err;
  }

  if (item.status === 'APPROVED') return item;
  if (item.status === 'NOT_APPLICABLE') {
    const err = new Error('العنصر غير منطبق على هذه الدورة');
    err.statusCode = 400;
    throw err;
  }

  const allowed = await permissions.canDecideElement(user, activeRole, item.course);
  if (!allowed) {
    const err = new Error('لا تملك صلاحية تقفيل هذا العنصر');
    err.statusCode = 403;
    throw err;
  }

  const now = new Date();
  const note = String(data.notes || '').trim();
  // تقفيل ذرّي: يُسمح به فقط إذا لم يكن العنصر قد اعتُمد أو أصبح غير منطبق بالتزامن
  const directResult = await repo.updateManyNotInStatus(trackingId, ['APPROVED', 'NOT_APPLICABLE'], {
    status: 'APPROVED',
    executionAt: item.executionAt || now,
    executedById: item.executedById || user.id,
    decisionAt: now,
    decidedById: user.id,
    rejectionReason: null,
    notes: note || `${item.element.name} مكتمل خارج منصة السلف`,
    formData: {
      source: 'manual_external_solf',
      note: note || null,
      closedAt: now.toISOString(),
      closedBy: user.email,
    },
  });

  if (directResult.count === 0) {
    const err = new Error('تغيّرت حالة العنصر، يرجى إعادة المحاولة');
    err.statusCode = 409;
    throw err;
  }

  const result = await repo.findTrackingById(trackingId);

  await logAudit(user.id, activeRole, 'FINANCIAL_ELEMENT_MANUALLY_APPROVED', {
    elementKey: item.element.key,
    elementName: item.element.name,
    notes: note || null,
  }, item.courseId);

  await checkCourseClosure(item.courseId);
  return result;
}

async function getElementDetails(id) {
  return repo.findTrackingForExport(id);
}

// ── منح تمديد لموعد عنصر إقفال (المدير فقط) ──────────────────────
// منقول حرفياً من pages/api/closure/[id]/extend.js
async function extendElement(trackingId, { extensionHours, extensionReason }, user) {
  const tracking = await repo.findTrackingForExtend(trackingId);

  if (!tracking) {
    const err = new Error('عنصر الإقفال غير موجود');
    err.statusCode = 404;
    err.code = 'serverErrors.closureElements.notFound';
    throw err;
  }

  if (['APPROVED', 'NOT_APPLICABLE'].includes(tracking.status)) {
    const err = new Error('لا يمكن منح تمديد لعنصر مكتمل أو غير مطلوب');
    err.statusCode = 400;
    err.code = 'serverErrors.closure.cannotExtendCompletedElement';
    throw err;
  }

  const updated = await repo.updateExtension(trackingId, {
    extensionHours: Number(extensionHours),
    extensionReason: extensionReason.trim(),
    extensionGrantedById: user.id,
    extensionGrantedAt: new Date(),
  });

  // إشعار الموظف بالتمديد
  await createNotification(
    tracking.course.primaryEmployeeId,
    'ELEMENT_EXTENSION_GRANTED',
    `تمديد موعد: ${tracking.element.name}`,
    `منحك المدير تمديداً لـ ${extensionHours} ساعة على العنصر "${tracking.element.name}" في الدورة "${tracking.course.name}". السبب: ${extensionReason.trim()}.`,
    { trackingId, courseId: tracking.courseId, elementName: tracking.element.name, extensionHours: Number(extensionHours) },
  );

  await logAudit(user.id, 'MANAGER', 'ELEMENT_EXTENSION_GRANTED', {
    trackingId,
    elementName: tracking.element.name,
    extensionHours: Number(extensionHours),
    extensionReason: extensionReason.trim(),
  }, tracking.courseId);

  return updated;
}

// ── إدارة عناصر الإقفال الرئيسية (ClosureElement master CRUD) ────
// منقول حرفياً من pages/api/closure-elements/*.js

// الحقول البوليانية في Course التي يمكن استخدامها كشرط لعنصر CONDITIONAL
const ALLOWED_CONDITION_FIELDS = [
  'requiresAdvance',
  'requiresRevenue',
  'materialsIssued',
  'requiresAdvanceSettlement',
  'requiresSupervisorCompensation',
  'requiresTrainerCompensation',
  'requiresPreTest',
  'requiresPostTest',
  'requiresOpeningReport',
  'requiresClosingReport',
];

const ALLOWED_TYPES = ['MANDATORY', 'CONDITIONAL', 'OPTIONAL'];

async function listElements() {
  return repo.findAllElements();
}

async function createElement(dto, user, activeRole) {
  const { name, elementType, conditionField, isFormBased, deadlineRefPoint, deadlineIdealHours, deadlineMaxHours, isDeadlineWorkingDays } = dto;

  if (!name || !String(name).trim()) {
    const err = new Error('اسم العنصر مطلوب');
    err.statusCode = 400;
    err.code = 'serverErrors.closureElements.nameRequired';
    throw err;
  }

  const type = ALLOWED_TYPES.includes(elementType) ? elementType : 'MANDATORY';

  if (type === 'CONDITIONAL' && !ALLOWED_CONDITION_FIELDS.includes(conditionField)) {
    const err = new Error('حقل الشرط غير صالح لعنصر مشروط');
    err.statusCode = 400;
    err.code = 'serverErrors.closureElements.invalidConditionField';
    throw err;
  }

  const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const created = await repo.createElement({
    key,
    name: String(name).trim(),
    isFormBased: !!isFormBased,
    deadlineRefPoint: deadlineRefPoint || null,
    deadlineIdealHours: deadlineIdealHours ?? null,
    deadlineMaxHours: deadlineMaxHours ?? null,
    isDeadlineWorkingDays: !!isDeadlineWorkingDays,
    elementType: type,
    conditionField: type === 'CONDITIONAL' ? conditionField : null,
    isActive: true,
    isCustom: true,
    createdById: user.id,
  });

  // إنشاء سجلات تتبع لهذا العنصر في كل الدورات المفتوحة (غير المغلقة/المؤرشفة)
  const openCourses = await repo.findOpenCoursesForElement();

  const trackingData = openCourses.map((course) => {
    let status = 'NOT_STARTED';
    if (type === 'CONDITIONAL' && created.conditionField) {
      status = course[created.conditionField] ? 'NOT_STARTED' : 'NOT_APPLICABLE';
    } else if (type === 'OPTIONAL') {
      status = 'NOT_APPLICABLE';
    }
    return { courseId: course.id, elementId: created.id, status };
  });

  if (trackingData.length) {
    await repo.createTrackingMany(trackingData);
  }

  await logAudit(user.id, activeRole, 'CLOSURE_ELEMENT_CREATED', { elementId: created.id, name: created.name, elementType: type, affectedCourses: trackingData.length }, null);

  return created;
}

async function updateElement(id, dto, user, activeRole) {
  const element = await repo.findElementById(id);
  if (!element) {
    const err = new Error('العنصر غير موجود');
    err.statusCode = 404;
    err.code = 'serverErrors.closureElements.notFound';
    throw err;
  }

  const { isActive, name } = dto;
  const data = {};

  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (typeof name === 'string' && name.trim()) data.name = name.trim();

  if (!Object.keys(data).length) {
    const err = new Error('لا توجد بيانات لتحديثها');
    err.statusCode = 400;
    err.code = 'serverErrors.closureElements.noDataToUpdate';
    throw err;
  }

  const updated = await repo.updateElement(id, data);

  await logAudit(
    user.id,
    activeRole,
    'CLOSURE_ELEMENT_UPDATED',
    { elementId: id, name: element.name, changes: data },
    null
  );

  return updated;
}

module.exports = {
  updateStatus,
  submitOpeningReport,
  submitClosingReport,
  submitAdvance,
  submitSettlement,
  approveFinancialElementDirectly,
  getElementDetails,
  checkCourseClosure,
  extendElement,
  listElements,
  createElement,
  updateElement,
};
