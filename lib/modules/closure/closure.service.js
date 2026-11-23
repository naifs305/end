// =============================================================
// وحدة الإقفال — حالات الاستخدام (Service)
// آلة حالة عناصر الإقفال + التحديثات الذرّية + فصل المهام + التقارير.
// المنطق منقول حرفياً من lib/services/closure.js مع إبقاء جميع
// الحُرّاس ورموز الأخطاء وآثار التدقيق/الإشعارات/البريد كما هي.
// =============================================================
const repo = require('./closure.repo');
const blockersRepo = require('../blockers/blockers.repo');
const { AppError } = require('../../shared/AppError');
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
  // دورة بلا عناصر لا تُقفل تلقائياً — لم يبدأ متابعتها أحد بعد
  const allClosed = elements.length > 0
    && elements.every((item) => ['APPROVED', 'NOT_APPLICABLE'].includes(item.status));

  if (allClosed) {
    // لحظة الانتقال إلى «مقفلة» وحدها يُطلب من المنسق تقييم صعوبات الإقفال
    const before = await repo.findCourseBrief(courseId);
    await repo.setCourseStatus(courseId, 'CLOSED');
    await logAudit('system', 'SYSTEM', 'COURSE_CLOSED', {}, courseId);
    if (before && !['CLOSED', 'ARCHIVED'].includes(before.status)) {
      await require('../departments/departments.service').notifyOnClosure(before);
    }
  }
}

/**
 * كنس دوري: كل دورة اكتملت عناصرها (معتمدة أو غير منطبقة) ولم تُقفل —
 * لأن آخر عناصرها عُطّل أو أُوقف أو تقاعد من غير مسار الاعتماد — تُقفل الآن.
 */
async function closeFinishedCourses() {
  const prisma = require('../../db/prisma');
  const courses = await prisma.course.findMany({
    where: {
      status: { notIn: ['CLOSED', 'ARCHIVED'] },
      closureElements: { some: {}, every: { status: { in: ['APPROVED', 'NOT_APPLICABLE'] } } },
    },
    select: { id: true },
  });
  for (const c of courses) await checkCourseClosure(c.id);
  return courses.length;
}

/** يطبّق نوع العنصر الجديد على الدورات غير المقفلة — بلا أثر رجعي */
async function applyTypeToOpenCourses(element) {
  const prisma = require('../../db/prisma');
  const now = new Date();
  const open = { status: { notIn: ['CLOSED', 'ARCHIVED'] } };
  const notStarted = { status: 'PREPARATION', startDate: { gt: now } };
  let count = 0;

  // يسقط: ما لم يُقدَّم ولم يُوقف بفترة مؤسسية
  const drop = (courseWhere) => prisma.courseClosureTracking.updateMany({
    where: { elementId: element.id, course: courseWhere, status: { in: ['NOT_STARTED', 'RETURNED', 'REJECTED'] }, executionAt: null, suspensionId: null },
    data: { status: 'NOT_APPLICABLE' },
  });
  // يُضاف: غير المنطبق في دورة لم تبدأ، ما لم يُعفه المدير أو يوقفه إيقاف
  const add = (courseWhere) => prisma.courseClosureTracking.updateMany({
    where: { elementId: element.id, course: courseWhere, status: 'NOT_APPLICABLE', suspensionId: null, overriddenById: null },
    data: { status: 'NOT_STARTED' },
  });

  if (element.elementType === 'OPTIONAL') {
    count += (await drop(open)).count;
  } else if (element.elementType === 'MANDATORY') {
    count += (await add(notStarted)).count;
  } else if (element.elementType === 'CONDITIONAL' && element.conditionField) {
    const [field, value] = element.conditionField.includes('=') ? element.conditionField.split('=') : [element.conditionField, null];
    const matches = value !== null ? { [field]: value } : { [field]: true };
    count += (await add({ ...notStarted, ...matches })).count;
    count += (await drop({ ...open, NOT: matches })).count;
  }

  // دورات لم يبقَ فيها إلا ما سقط تُقفل الآن
  if (element.elementType !== 'MANDATORY') {
    const finished = await prisma.course.findMany({
      where: { ...open, closureElements: { some: { elementId: element.id }, every: { status: { in: ['APPROVED', 'NOT_APPLICABLE'] } } } },
      select: { id: true },
    });
    for (const c of finished) await checkCourseClosure(c.id);
  }
  return count;
}

/** سبب واضح لرفض اعتماد عنصر — يعرف به المشرف ما يفعل */
async function decideRefusalReason(user, activeRole, course) {
  if (activeRole !== 'PROJECT_SUPERVISOR') return 'الاعتماد للمشرف أو المدير — بدّل دورك من أعلى الصفحة';
  try {
    const prisma = require('../../db/prisma');
    const owner = course.primaryEmployeeId
      ? await prisma.user.findUnique({ where: { id: course.primaryEmployeeId }, select: { isCollaborator: true, followUpSupervisorId: true } })
      : null;
    if (owner?.isCollaborator) {
      return owner.followUpSupervisorId
        ? 'هذه دورة منسق متعاون يتابعه مشرف آخر — يعتمدها هو أو المدير'
        : 'هذه دورة منسق متعاون لم يُسند لمشرف — يعتمدها المدير، أو يُسند متابعته لمشرف من صفحة المستخدم';
    }
    if (course.courseType === 'external') {
      return 'هذه دورة خارجية يعتمدها مشرف مشروع منسّقها أو المدير';
    }
  } catch { /* السبب العام يكفي */ }
  return 'هذه الدورة في مشروع لا تشرف عليه — يعتمدها مشرف مشروعها أو المدير';
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
      // عقد المترجم لا يكتمل بإخراجه، بل بتوقيع وكيل الجامعة عليه.
      // فلا يُقدَّم للاعتماد قبل أن يُؤكَّد التوقيع بتاريخه — وهذا هو
      // الإنجاز الحقيقي للعنصر، لا مجرد إعداد الورقة.
      if (item.element.key === 'interpreter_contract') {
        const signedAt = item.formData && item.formData.agentSignedAt;
        if (!signedAt) {
          throw AppError.badRequest(
            'لا يُقدَّم عقد المترجم قبل تأكيد توقيع وكيل الجامعة عليه',
            'serverErrors.interpreter.agentSignatureRequired',
          );
        }
      }

      // لا تُطلق شهادة قبل معرفة نوعها (حضور أو اجتياز)
      if (item.element.key === 'certificates' && item.course?.certificateType === 'PENDING') {
        throw AppError.badRequest(
          'أكّد نوع الشهادة (حضور أو اجتياز) قبل تقديم الشهادات',
          'serverErrors.course.certificateTypePending',
        );
      }

      // الشهادات لا تُقدَّم قبل أن يؤكد منسق آخر مراجعتها
      if (item.element.key === 'certificates') {
        const { isConfirmed } = require('../certReview/certReview.service');
        if (!isConfirmed(data.formData ?? item.formData)) {
          throw AppError.badRequest(
            'لا تُقدَّم الشهادات قبل أن يؤكد المنسق المراجِع مراجعتها',
            'serverErrors.certReview.notConfirmed',
          );
        }
      }

      // دليل السفر التعريفي يكتمل بتسليم الدليل نفسه، لا بطلب تصميمه
      if (item.element.key === 'travel_guide') {
        const guide = (data.formData ?? item.formData)?.travelGuide;
        if (!guide?.url) {
          throw AppError.badRequest(
            'أرفق رابط دليل السفر قبل التقديم — وإن لم يوجد دليل فاطلب تصميمه وانتظر وصوله',
            'serverErrors.travelGuide.urlRequired',
          );
        }
      }

      // يمكن التقديم من «لم يبدأ» أو «مُعاد» أو «مرفوض» — فالمرفوض يُصحَّح
      // ويُعاد تقديمه، وإلا بقي طريقاً مسدوداً يمنع إقفال الدورة للأبد
      if (!['NOT_STARTED', 'RETURNED', 'REJECTED'].includes(item.status)) {
        const err = new Error(
          item.status === 'APPROVED'
            ? 'العنصر مُعتمد بالفعل ولا يمكن إعادة تقديمه'
            : 'لا يمكن تقديم العنصر في حالته الحالية'
        );
        err.statusCode = 400;
        throw err;
      }

      // تحديث ذرّي: يُسمح بالتقديم فقط إذا كانت الحالة لا تزال NOT_STARTED أو RETURNED
      const submitResult = await repo.updateManyByStatus(trackingId, { in: ['NOT_STARTED', 'RETURNED', 'REJECTED'] }, {
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

      // زال العائق بالتقديم — نُغلق أي بلاغ قائم على العنصر حتى لا
      // تستمر الساعة متوقفة بعد أن عاد المنسق إلى العمل.
      await blockersRepo.resolveOpenBlockersForTracking(trackingId, new Date());

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
      const err = new Error(await decideRefusalReason(user, activeRole, item.course));
      err.statusCode = 403;
      throw err;
    }

    // فصل المهام: لا يجوز للمنفِّذ أن يكون هو المُعتمِد لنفس العنصر
    if (item.executedById && item.executedById === user.id) {
      const err = new Error('لا يمكنك اعتماد أو رفض عنصر قمت بتنفيذه (يلزم فصل المهام)');
      err.statusCode = 403;
      throw err;
    }

    // والمشرف لا يعتمد عناصر دورة ينسّقها هو — يعتمدها المدير
    if (activeRole === 'PROJECT_SUPERVISOR' && item.course?.primaryEmployeeId === user.id) {
      throw AppError.forbidden('هذه دورة تنسّقها أنت — يعتمد عناصرها المدير (فصل المهام)', 'serverErrors.closure.ownCourse');
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

// حفظ مسودة تقرير الافتتاح/الاختتام دون إرسالها للاعتماد
async function saveReportDraft(trackingId, dto, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);

  if (!item) {
    throw AppError.notFound('عنصر الإقفال غير موجود', 'serverErrors.closureElements.notFound');
  }

  if (!['opening_report', 'closing_report'].includes(item.element.key)) {
    throw AppError.badRequest('حفظ المسودة متاح فقط لتقارير الافتتاح والاختتام', 'serverErrors.closure.draftOnlyForReports');
  }

  if (!['NOT_STARTED', 'RETURNED', 'REJECTED'].includes(item.status)) {
    throw AppError.badRequest('لا يمكن حفظ مسودة لعنصر في حالته الحالية', 'serverErrors.closure.draftNotAllowedInStatus');
  }

  const allowed = await permissions.canSubmitElement(user, activeRole, item.course);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }

  const normalized = normalizeReportDto(dto);
  const result = await repo.updateTracking(trackingId, {
    formData: normalized,
    executionAt: new Date(),
    executedById: user.id,
  });

  await logAudit(user.id, activeRole, 'ELEMENT_DRAFT_SAVED', {
    elementKey: item.element.key,
    elementName: item.element.name,
  }, item.courseId);

  return result;
}

// ======================================================================
// نصوص مستندات المترجم
// ----------------------------------------------------------------------
// المنسق يعدّل نص العقد أو نموذج الاستحقاق قبل التصدير، فنحفظ ما
// كتبه مع العنصر نفسه — فلا يضيع بإغلاق الصفحة، ويخرج كما تركه في
// كل مرة يُصدَّر فيها المستند.
// ======================================================================

const INTERPRETER_ELEMENT_KEYS = [
  'interpreter_contract',
  'interpreter_transfer',
  'interpreter_advance',
  'interpreter_certificate',
];

async function saveInterpreterDocumentText(trackingId, dto, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);

  if (!item) {
    throw AppError.notFound('عنصر الإقفال غير موجود', 'serverErrors.closureElements.notFound');
  }

  if (!INTERPRETER_ELEMENT_KEYS.includes(item.element.key)) {
    throw AppError.badRequest('هذا العنصر ليس من مستندات المترجم', 'serverErrors.interpreter.notInterpreterElement');
  }

  const allowed = await permissions.canSubmitElement(user, activeRole, item.course);
  if (!allowed) {
    throw AppError.forbidden('لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }

  const incoming = dto && typeof dto.sections === 'object' && dto.sections ? dto.sections : {};
  const sections = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (typeof value !== 'string') continue;
    sections[String(key).slice(0, 60)] = value.slice(0, 20000);
  }

  const formData = { ...(item.formData || {}) };
  if (dto && dto.sections !== undefined) formData.documentSections = sections;

  // تأكيد توقيع وكيل الجامعة على العقد، بتاريخه
  if (dto && dto.agentSignedAt !== undefined) {
    const raw = String(dto.agentSignedAt || '').trim();
    if (!raw) {
      formData.agentSignedAt = null;
    } else {
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw AppError.badRequest('تاريخ التوقيع غير صحيح', 'serverErrors.interpreter.signatureDateInvalid');
      }
      if (date > new Date()) {
        throw AppError.badRequest('تاريخ التوقيع لا يكون في المستقبل', 'serverErrors.interpreter.signatureDateFuture');
      }
      formData.agentSignedAt = date.toISOString();
      formData.agentSignedConfirmedById = user.id;
    }
  }

  const result = await repo.updateTracking(trackingId, { formData });

  await logAudit(user.id, activeRole, 'INTERPRETER_DOCUMENT_TEXT_SAVED', {
    elementKey: item.element.key,
    elementName: item.element.name,
  }, item.courseId);

  return result;
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
  'requiresInterpreter',
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

  const { isActive, name, elementType, applyToOpen } = dto;
  const data = {};

  if (typeof isActive === 'boolean') data.isActive = isActive;
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (elementType !== undefined) {
    if (!['MANDATORY', 'OPTIONAL', 'CONDITIONAL'].includes(elementType)) {
      throw AppError.badRequest('نوع العنصر غير صحيح — إجباري أو اختياري أو مشروط', 'serverErrors.closureElements.badType');
    }
    if (elementType === 'CONDITIONAL' && !element.conditionField) {
      throw AppError.badRequest('لا شرط محفوظاً لهذا العنصر — اختر إجبارياً أو اختيارياً', 'serverErrors.closureElements.noCondition');
    }
    if (elementType !== element.elementType) data.elementType = elementType;
  }

  if (!Object.keys(data).length) {
    const err = new Error('لا توجد بيانات لتحديثها');
    err.statusCode = 400;
    err.code = 'serverErrors.closureElements.noDataToUpdate';
    throw err;
  }

  const updated = await repo.updateElement(id, data);

  // تغيير النوع يسري على الدورات الجديدة دائماً، وعلى الجارية إن طُلب:
  //   اختياري ← يسقط من الجارية ما لم يُقدَّم (ويفعّله منسقها إن احتاجه)
  //   إجباري/مشروط ← يُضاف للدورات التي لم تبدأ بعد فقط، فلا يُطالَب أحد بأثر رجعي
  let applied = 0;
  if (data.elementType && applyToOpen === true) {
    applied = await applyTypeToOpenCourses({ ...element, ...data });
  }

  await logAudit(
    user.id,
    activeRole,
    'CLOSURE_ELEMENT_UPDATED',
    { elementId: id, name: element.name, changes: data, appliedToOpenCourses: applied },
    null
  );

  return { ...updated, appliedToOpenCourses: applied };
}

module.exports = {
  updateStatus,
  submitOpeningReport,
  submitClosingReport,
  submitAdvance,
  submitSettlement,
  getElementDetails,
  checkCourseClosure,
  closeFinishedCourses,
  extendElement,
  saveReportDraft,
  listElements,
  createElement,
  updateElement,
  saveInterpreterDocumentText,
  INTERPRETER_ELEMENT_KEYS,
};
