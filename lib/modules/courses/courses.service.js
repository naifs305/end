// =============================================================
// وحدة الدورات — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (permissions) وسجل التدقيق.
// المنطق منقول حرفياً من lib/services/courses.js مع إبقاء جميع
// الحُرّاس ورموز الأخطاء وآثار التدقيق كما هي.
// =============================================================
const repo = require('./courses.repo');
const suspensions = require('../closure/suspensions.service');
const lateEntry = require('./lateEntry');
const elementLinks = require('./elementLinks');
const deadlines = require('../../shared/deadlines');
const permissions = require('../../services/permissions');
const { logAudit } = require('../../services/audit');
const { createNotification } = require('../../services/notifications');

// دورة حياة الدورة: PREPARATION → EXECUTION → AWAITING_CLOSURE → CLOSED → ARCHIVED
const COURSE_STATUSES = ['PREPARATION', 'EXECUTION', 'AWAITING_CLOSURE', 'CLOSED', 'ARCHIVED'];

const ALLOWED_TRANSITIONS = {
  PREPARATION: ['EXECUTION', 'AWAITING_CLOSURE'],
  EXECUTION: ['AWAITING_CLOSURE'],
  AWAITING_CLOSURE: ['CLOSED', 'EXECUTION'],   // السماح للمدير بإعادتها إلى التنفيذ
  CLOSED: ['ARCHIVED', 'AWAITING_CLOSURE'],     // السماح بإعادة فتح دورة أُقفلت خطأً
  ARCHIVED: [],
};

// أنواع التعاقد مع مترجم الدورة
const INTERPRETER_CONTRACT_TYPES = ['CONTRACT', 'TRANSFER', 'ADVANCE'];

function isValidCourseStatusTransition(from, to) {
  return from === to || (ALLOWED_TRANSITIONS[from] || []).includes(to);
}

// conditionField: اسم حقل boolean في Course، أو على شكل "field=value" لمطابقة قيمة نصية
function fieldNameOf(conditionField) {
  return conditionField.includes('=') ? conditionField.split('=')[0] : conditionField;
}

function evaluateCondition(courseLike, conditionField) {
  if (conditionField.includes('=')) {
    const [field, value] = conditionField.split('=');
    return courseLike[field] === value;
  }
  return !!courseLike[conditionField];
}

async function initializeClosureElements(course, tx) {
  const [allElements, activeSuspensions] = await Promise.all([
    repo.findActiveClosureElements(tx),
    suspensions.findAllActiveSuspensions(tx),
  ]);

  const suspensionByElement = new Map();
  for (const s of activeSuspensions) {
    if (suspensions.suspensionCoversDate(s, course.startDate)) {
      suspensionByElement.set(s.elementId, s);
    }
  }

  const data = allElements.map((el) => {
    let status = 'NOT_STARTED';

    if (el.elementType === 'CONDITIONAL' && el.conditionField) {
      status = evaluateCondition(course, el.conditionField) ? 'NOT_STARTED' : 'NOT_APPLICABLE';
    } else if (el.elementType === 'OPTIONAL') {
      // عناصر اختيارية: غير مفعّلة افتراضياً، يفعّلها الموظف لاحقاً عند الحاجة
      status = 'NOT_APPLICABLE';
    }

    // فترة إيقاف مؤسسية سارية على تاريخ بداية الدورة تُسقط العنصر
    // مهما كان نوعه — والمنسق لا يفعل شيئاً ولا يُسأل.
    const suspension = suspensionByElement.get(el.id);
    if (suspension) {
      return {
        courseId: course.id,
        elementId: el.id,
        status: 'NOT_APPLICABLE',
        suspensionId: suspension.id,
      };
    }

    return { courseId: course.id, elementId: el.id, status };
  });

  await repo.createClosureTracking(data, tx);
}

async function generateCourseCode(tx) {
  const year = new Date().getFullYear();
  const prefix = `od-${year}-`;
  const latest = await repo.findLatestCourseByCodePrefix(prefix, tx);
  const lastNumber = Number.parseInt(latest?.code?.slice(prefix.length) || '0', 10) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
}

async function refreshConditionalElements(courseId, data) {
  const elements = await repo.findConditionalElements();

  for (const el of elements) {
    const field = fieldNameOf(el.conditionField);
    if (data[field] === undefined) continue;

    const applicable = evaluateCondition(data, el.conditionField);

    await repo.updateConditionalTracking(courseId, el.id, applicable ? 'NOT_STARTED' : 'NOT_APPLICABLE');
  }
}

async function createCourse(dto, user, activeRole) {
  const allowed = await permissions.canCreateCourseInProject(user, activeRole, dto.operationalProjectId);
  if (!allowed) {
    const err = new Error('لا تملك صلاحية إنشاء دورة في هذا المشروع');
    err.statusCode = 403;
    throw err;
  }

  const primaryEmployeeId = activeRole === 'EMPLOYEE' ? user.id : (dto.primaryEmployeeId || user.id);

  // الإدخال المتأخر: المنصة تقيسه بنفسها، والمبرر إلزامي عند التأخر.
  // لا نمنع الإدخال في أي حال — منعه يعني ضياع الدورة من السجل كله.
  const late = await lateEntry.buildLateEntryFields(dto, new Date());
  if (late.isLate && !late.reason) {
    const err = new Error('الدورة مُدخَلة بعد موعدها — مبرر التأخير مطلوب');
    err.statusCode = 400;
    err.code = 'serverErrors.course.lateEntryReasonRequired';
    throw err;
  }

  const course = await repo.runTransaction(async (tx) => {
    const code = await generateCourseCode(tx);
    const created = await repo.createCourseTx({
      name: dto.name,
      code,
      beneficiaryEntity: dto.beneficiaryEntity || 'غير محدد',
      city: dto.city,
      locationType: dto.locationType,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      numTrainees: Number(dto.numTrainees || 0),
      courseType: dto.courseType,
      requiresAdvance: !!dto.requiresAdvance,
      requiresRevenue: !!dto.requiresRevenue,
      materialsIssued: !!dto.materialsIssued,
      // السلفة تُسوَّى حتماً: لا تُؤخذ سلفة بلا تسوية. فالتسوية تتبع
      // السلفة ولا تُترك لذاكرة المنسق ولا لاختياره.
      ...elementLinks.deriveLinkedFlags(dto),
      requiresSupervisorCompensation: !!dto.requiresSupervisorCompensation,
      requiresTrainerCompensation: !!dto.requiresTrainerCompensation,
      requiresPreTest:  !!dto.requiresPreTest,
      requiresPostTest: !!dto.requiresPostTest,
      isCrossProject:   !!dto.isCrossProject,
      // مترجم الدورة: نوع التعاقد لا يُحفظ إلا مع تفعيل المترجم
      requiresInterpreter: !!dto.requiresInterpreter,
      interpreterContractType: dto.requiresInterpreter
        ? (INTERPRETER_CONTRACT_TYPES.includes(dto.interpreterContractType) ? dto.interpreterContractType : null)
        : null,
      // التقارير: خارجية = إجبارية تلقائياً
      requiresOpeningReport: dto.courseType === 'external' ? true : !!dto.requiresOpeningReport,
      requiresClosingReport: dto.courseType === 'external' ? true : !!dto.requiresClosingReport,
      // الحالة تُشتقّ من التواريخ: دورة منتهية تُنشأ "بانتظار الإقفال"
      // لا "تحت الإعداد"
      ...late.fields,
      operationalProject: { connect: { id: dto.operationalProjectId } },
      primaryEmployee: { connect: { id: primaryEmployeeId } },
      supportingTeam: dto.supportingEmployeeIds?.length
        ? { create: dto.supportingEmployeeIds.map((id) => ({ userId: id })) }
        : undefined,
    }, tx);

    await initializeClosureElements(created, tx);
    return created;
  }, { timeout: 30000 }); // 30 ثانية لتجنب timeout مع pgbouncer

  await logAudit(user.id, activeRole, 'COURSE_CREATED', {
    courseName: course.name,
    ...(late.isLate
      ? {
        isLateEntry: true,
        hoursLate: late.hoursLate,
        latenessLabel: lateEntry.describeLateness(late.hoursLate),
        reason: late.reason,
      }
      : {}),
  }, course.id);

  // التأخير يصل المدير فوراً ليبتّ في المبرر — ولا يُترك معلّقاً
  if (late.isLate) {
    await notifyManagersOfLateEntry(course, late, user);
  }

  // أعِد جلب الدورة مع عناصر الإقفال بعد إنشائها
  return repo.findFullById(course.id);
}

async function notifyManagersOfLateEntry(course, late, user) {
  const managers = await repo.findManagerIds();
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  for (const managerId of managers) {
    if (managerId === user.id) continue;
    await createNotification(
      managerId,
      'COURSE_LATE_ENTRY',
      `دورة أُدخلت متأخرة: ${course.name}`,
      `أدخل ${name} الدورة "${course.name}" متأخرة بـ${lateEntry.describeLateness(late.hoursLate)}. المبرر: ${late.reason}. يلزم قرارك: قبول المبرر فلا تُسجَّل ملاحظة، أو رفضه فتُسجَّل نقطة — والدورة مضافة في الحالين.`,
      { courseId: course.id, hoursLate: late.hoursLate },
    );
  }
}

/**
 * قرار المدير في مبرر الإدخال المتأخر.
 * القبول يرفع الملاحظة ويستثني العناصر التي كانت مستحيلة قبل
 * الإدخال. والرفض يُبقي العقوبة كاملة — والدورة باقية في الحالين.
 */
async function decideLateEntry(courseId, { accept, note }, user, activeRole) {
  if (activeRole !== 'MANAGER') {
    const err = new Error('قرار الإدخال المتأخر للمدير وحده');
    err.statusCode = 403;
    err.code = 'serverErrors.course.lateEntryDecisionForbidden';
    throw err;
  }

  const course = await repo.findByIdRaw(courseId);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    err.code = 'serverErrors.course.notFound';
    throw err;
  }
  if (!course.isLateEntry) {
    const err = new Error('هذه الدورة لم تُدخَل متأخرة');
    err.statusCode = 400;
    err.code = 'serverErrors.course.notLateEntry';
    throw err;
  }
  if (course.lateEntryStatus !== 'PENDING') {
    const err = new Error('سبق البتّ في هذا المبرر');
    err.statusCode = 400;
    err.code = 'serverErrors.course.lateEntryAlreadyDecided';
    throw err;
  }
  if (!accept && !String(note || '').trim()) {
    const err = new Error('سبب الرفض مطلوب');
    err.statusCode = 400;
    err.code = 'serverErrors.course.lateEntryRejectReasonRequired';
    throw err;
  }

  const updated = await repo.updateCourseRaw(courseId, {
    lateEntryStatus: accept ? 'ACCEPTED' : 'REJECTED',
    lateEntryDecidedById: user.id,
    lateEntryDecidedAt: new Date(),
    lateEntryDecisionNote: String(note || '').trim() || null,
  });

  await logAudit(user.id, activeRole, accept ? 'COURSE_LATE_ENTRY_ACCEPTED' : 'COURSE_LATE_ENTRY_REJECTED', {
    courseName: course.name,
    hoursLate: course.lateEntryHours,
    note: note || null,
  }, courseId);

  await createNotification(
    course.primaryEmployeeId,
    accept ? 'LATE_ENTRY_ACCEPTED' : 'LATE_ENTRY_REJECTED',
    accept ? `قُبل مبرر تأخر إدخال: ${course.name}` : `رُفض مبرر تأخر إدخال: ${course.name}`,
    accept
      ? `قبل المدير مبرر تأخر إدخالك للدورة "${course.name}". لا تُسجَّل عليك ملاحظة، والعناصر التي فات موعدها قبل الإدخال لا تُحتسب في توقيتك.`
      : `رفض المدير مبرر تأخر إدخالك للدورة "${course.name}". السبب: ${note}. تُسجَّل نقطة على الانضباط، والمواعيد محتسبة من تواريخ الدورة الأصلية.`,
    { courseId },
  );

  return updated;
}

/** طابور المبررات المنتظرة — يراها المدير في مكان واحد */
async function listPendingLateEntries(user, activeRole) {
  if (activeRole !== 'MANAGER') {
    const err = new Error('غير مصرح');
    err.statusCode = 403;
    err.code = 'serverErrors.common.forbidden';
    throw err;
  }
  return repo.findPendingLateEntries();
}

async function findAllCourses(user, activeRole, projectId, status, page = 1, limit = 50) {
  const extraWhere = {};
  if (projectId) extraWhere.operationalProjectId = projectId;
  if (status) extraWhere.status = status;

  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const [total, data] = await Promise.all([
    repo.count(where),
    repo.findMany({
      where,
      include: {
        primaryEmployee: { select: { id: true, firstName: true, lastName: true, email: true, profileImage: true, isCollaborator: true } },
        operationalProject: { select: { id: true, name: true } },
        supportingTeam: { include: { user: { select: { id: true, firstName: true, lastName: true, profileImage: true } } } },
        _count: { select: { closureElements: true } },
        closureElements: { select: { status: true } },
        // نجمة التميّز تظهر على بطاقة الدورة
        documentation: { select: { starAwarded: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
  ]);

  return { data, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

async function findOneCourse(id, user, activeRole) {
  const course = await repo.findOneWithAudit(id);

  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  if (!(await permissions.canViewCourse(user, activeRole, course))) {
    const err = new Error('غير مصرح لك بالوصول إلى هذه الدورة');
    err.statusCode = 403;
    throw err;
  }

  return withComputedDeadlines(course);
}

/**
 * يُلحق بكل عنصر موعديه المحسوبين من المصدر الواحد.
 * الشاشة تعرض ما يرسله الخادم ولا تحسب شيئاً — فالموعد الذي يراه
 * المنسق هو بعينه الموعد الذي تُحاسبه عليه المؤشرات.
 */
function withComputedDeadlines(course) {
  if (!course?.closureElements?.length) return course;

  const now = new Date();
  return {
    ...course,
    closureElements: course.closureElements.map((el) => {
      const d = deadlines.computeElementDeadlines(el, course, now);
      return {
        ...el,
        deadlines: {
          hasDeadline: d.hasDeadline,
          idealDeadline: d.idealDeadline,
          maxDeadline: d.maxDeadline,
          baseIdealDeadline: d.baseIdealDeadline,
          baseMaxDeadline: d.baseMaxDeadline,
          extensionHours: d.extensionHours,
          idealPauseHours: Math.round(d.idealPauseHours),
          maxPauseHours: Math.round(d.maxPauseHours),
          hasOpenBlocker: d.hasOpenBlocker,
          excludedFromTiming: d.excludedFromTiming,
          exclusionReason: d.exclusionReason,
          isOverdue: d.isOverdue,
          // نتيجة التوقيت كما تُحتسب في المؤشرات (100 / 70 / 20 / 0 / null)
          timeScore: deadlines.calcElementTimeScore(el, course, now),
        },
      };
    }),
  };
}

async function updateCourse(id, dto, user, activeRole) {
  const course = await repo.findByIdWithSupportingTeam(id);

  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  const check = await permissions.canEditCourse(user, activeRole, course);
  if (!check.allowed) {
    const err = new Error(check.reason || 'غير مصرح');
    err.statusCode = 403;
    throw err;
  }

  // التحقق من انتقال الحالة عند تغييرها فقط
  if (dto.status !== undefined && dto.status !== course.status) {
    if (!COURSE_STATUSES.includes(dto.status)) {
      const err = new Error('حالة دورة غير صالحة');
      err.statusCode = 400;
      throw err;
    }
    if (!isValidCourseStatusTransition(course.status, dto.status)) {
      const err = new Error('انتقال حالة غير مسموح');
      err.statusCode = 400;
      throw err;
    }
  }

  const updateData = {};
  const fields = [
    'name', 'code', 'beneficiaryEntity', 'city', 'locationType', 'numTrainees', 'courseType',
    'requiresAdvance', 'requiresRevenue', 'materialsIssued',
    'requiresSupervisorCompensation', 'requiresTrainerCompensation',
    'requiresPreTest', 'requiresPostTest', 'isCrossProject', 'status',
  ];

  for (const field of fields) {
    if (dto[field] !== undefined) updateData[field] = dto[field];
  }

  // العناصر المترابطة: ما يتبع غيره يُشتق هنا لا من الواجهة
  const linked = elementLinks.deriveLinkedFlags(dto);
  Object.assign(updateData, linked);
  Object.assign(dto, linked); // ليراها إعادة تقييم شروط العناصر أدناه

  // مترجم الدورة: إلغاء المترجم يُلغي نوع التعاقد معه،
  // وتفعيله بلا نوع صحيح لا يُقبل
  if (dto.requiresInterpreter !== undefined) {
    updateData.requiresInterpreter = !!dto.requiresInterpreter;
    updateData.interpreterContractType = dto.requiresInterpreter
      ? (INTERPRETER_CONTRACT_TYPES.includes(dto.interpreterContractType)
        ? dto.interpreterContractType
        : (course.interpreterContractType || null))
      : null;
    dto.interpreterContractType = updateData.interpreterContractType;
  } else if (dto.interpreterContractType !== undefined && course.requiresInterpreter) {
    updateData.interpreterContractType = INTERPRETER_CONTRACT_TYPES.includes(dto.interpreterContractType)
      ? dto.interpreterContractType
      : course.interpreterContractType;
    dto.interpreterContractType = updateData.interpreterContractType;
  }

  // الدورة الخارجية: التقريران إجباريان دائماً
  if (dto.courseType === 'external') {
    updateData.requiresOpeningReport = true;
    updateData.requiresClosingReport = true;
    dto.requiresOpeningReport = true;
    dto.requiresClosingReport = true;
  }

  if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
  if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
  if (dto.operationalProjectId !== undefined) updateData.operationalProject = { connect: { id: dto.operationalProjectId } };
  if (dto.primaryEmployeeId !== undefined && activeRole !== 'EMPLOYEE') updateData.primaryEmployee = { connect: { id: dto.primaryEmployeeId } };
  // إقفال يدوي من المدير: نثبّت لحظة الإقفال الفعلي عند الانتقال إلى CLOSED
  if (updateData.status === 'CLOSED' && course.status !== 'CLOSED') updateData.closedAt = new Date();

  await repo.runTransaction(async (tx) => {
    await repo.updateCourseTx(id, updateData, tx);

    if (dto.supportingEmployeeIds !== undefined) {
      await repo.deleteSupportTx(id, tx);
      if (dto.supportingEmployeeIds.length) {
        await repo.createSupportTx(
          dto.supportingEmployeeIds.map((userId) => ({ courseId: id, userId })),
          tx,
        );
      }
    }
  });

  await refreshConditionalElements(id, dto);
  await logAudit(user.id, activeRole, 'COURSE_UPDATED', { courseId: id }, id);
  return findOneCourse(id, user, activeRole === 'EMPLOYEE' ? 'EMPLOYEE' : activeRole);
}

async function deleteCourse(id, user, activeRole) {
  const course = await repo.findByIdRaw(id);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  const check = await permissions.canDeleteCourse(user, activeRole, course);
  if (!check.allowed) {
    const err = new Error(check.reason || 'غير مصرح');
    err.statusCode = 403;
    throw err;
  }

  await logAudit(user.id, activeRole, 'COURSE_DELETED', { courseId: id, courseName: course.name }, id);

  await repo.deleteCourseCascade(id);

  return { success: true };
}

async function archiveCourse(id, user, activeRole) {
  const course = await repo.findByIdRaw(id);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  if (!(await permissions.canArchiveCourse(user, activeRole, course))) {
    const err = new Error('لا تملك صلاحية أرشفة هذه الدورة');
    err.statusCode = 403;
    throw err;
  }

  await repo.setStatus(id, 'ARCHIVED');
  await logAudit(user.id, activeRole, 'COURSE_ARCHIVED', { courseId: id }, id);
  return { success: true };
}

async function reassignCourse(id, newPrimaryEmployeeId, user, activeRole) {
  const course = await repo.findByIdWithPrimaryEmployee(id);

  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  if (!(await permissions.canReassignCourse(user, activeRole, course))) {
    const err = new Error('لا تملك صلاحية إعادة إسناد هذه الدورة');
    err.statusCode = 403;
    throw err;
  }

  const newEmployee = await repo.findUserById(newPrimaryEmployeeId);
  if (!newEmployee) {
    const err = new Error('الموظف الجديد غير موجود');
    err.statusCode = 400;
    throw err;
  }

  const updated = await repo.reassignPrimaryEmployee(id, newPrimaryEmployeeId);

  await logAudit(user.id, activeRole, 'COURSE_REASSIGNED', {
    courseId: id,
    fromEmployeeId: course.primaryEmployeeId,
    toEmployeeId: newEmployee.id,
  }, id);

  return updated;
}

async function findArchivedCourses(search, user, activeRole) {
  const extraWhere = { status: { in: ['CLOSED', 'ARCHIVED'] } };
  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);

  if (search?.trim()) {
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  return repo.findMany({
    where,
    include: repo.COURSE_FULL_INCLUDE,
    orderBy: { endDate: 'desc' },
  });
}

/**
 * advanceDueCourseLifecycles — يُقدّم الدورات تلقائياً عبر الحالات الوسيطة
 * بناءً على تواريخها (يُستدعى يومياً من المجدول).
 *   - endDate <= now  و الحالة PREPARATION/EXECUTION → AWAITING_CLOSURE
 *   - startDate <= now و الحالة PREPARATION (ولم ينتهِ بعد) → EXECUTION
 */
async function advanceDueCourseLifecycles() {
  const now = new Date();

  // 1) الدورات التي انتهت ولم تبدأ مرحلة الإقفال → AWAITING_CLOSURE
  const awaiting = await repo.advanceToAwaitingClosure(now);

  // 2) الدورات التي بدأت ولم تنتهِ بعد → EXECUTION
  const execution = await repo.advanceToExecution(now);

  return {
    toExecution: execution.count,
    toAwaitingClosure: awaiting.count,
  };
}

// ── تفعيل/تعطيل عنصر اختياري (OPTIONAL) لهذه الدورة ──────────────
// منقول حرفياً من pages/api/courses/[id]/toggle-element.js
async function toggleOptionalElement(courseId, { trackingId, enabled }, user, activeRole) {
  if (!trackingId || typeof enabled !== 'boolean') {
    const err = new Error('trackingId و enabled مطلوبان');
    err.statusCode = 400;
    err.code = 'serverErrors.course.toggleElementTrackingEnabledRequired';
    throw err;
  }

  const tracking = await repo.findTrackingWithCourseMini(trackingId);

  if (!tracking || tracking.courseId !== courseId) {
    const err = new Error('العنصر غير موجود');
    err.statusCode = 404;
    err.code = 'serverErrors.closureElements.notFound';
    throw err;
  }

  if (tracking.element.elementType !== 'OPTIONAL') {
    const err = new Error('هذا العنصر ليس اختيارياً');
    err.statusCode = 400;
    err.code = 'serverErrors.course.elementNotOptional';
    throw err;
  }

  const isCoordinator = tracking.course.primaryEmployeeId === user.id;
  const isApprover = ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);
  if (!isCoordinator && !isApprover) {
    const err = new Error('غير مصرح');
    err.statusCode = 403;
    err.code = 'serverErrors.common.forbidden';
    throw err;
  }

  if (['APPROVED', 'PENDING_APPROVAL'].includes(tracking.status) && !enabled) {
    const err = new Error('لا يمكن إلغاء عنصر مُقدّم أو مُعتمد');
    err.statusCode = 400;
    err.code = 'serverErrors.course.cannotDisableSubmittedElement';
    throw err;
  }

  const updated = await repo.updateTrackingStatus(trackingId, enabled ? 'NOT_STARTED' : 'NOT_APPLICABLE');

  await logAudit(user.id, activeRole, 'COURSE_OPTIONAL_ELEMENT_TOGGLED', {
    courseId, elementId: tracking.elementId, elementName: tracking.element.name, enabled,
  }, courseId);

  return updated;
}

// ── تفعيل/تعطيل تقرير (افتتاح/اختتام) على دورة قائمة ───────────────
// منقول حرفياً من pages/api/courses/[id]/toggle-report.js
async function toggleReport(courseId, { type, enabled }, user, activeRole) {
  if (!['opening', 'closing'].includes(type)) {
    const err = new Error('type يجب أن يكون opening أو closing');
    err.statusCode = 400;
    err.code = 'serverErrors.course.toggleReportInvalidType';
    throw err;
  }
  if (typeof enabled !== 'boolean') {
    const err = new Error('enabled يجب أن يكون boolean');
    err.statusCode = 400;
    err.code = 'serverErrors.course.toggleReportEnabledBoolean';
    throw err;
  }
  const course = await repo.findByIdRaw(courseId);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    err.code = 'serverErrors.course.notFound';
    throw err;
  }

  const field = type === 'opening' ? 'requiresOpeningReport' : 'requiresClosingReport';
  const voluntaryField = type === 'opening' ? 'openingReportVoluntary' : 'closingReportVoluntary';
  const elKey = type === 'opening' ? 'opening_report' : 'closing_report';

  const isManagerOrSupervisor = ['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole);
  let updateData;

  if (isManagerOrSupervisor) {
    // المسار الرسمي: يجعل التقرير إجبارياً/غير إجباري على الدورة
    updateData = { [field]: enabled, [voluntaryField]: false };
  } else {
    // مسار الموظف: تفعيل تطوّعي فقط، ولا يملك تعطيل تقرير مفعّل أصلاً
    if (!enabled) {
      const err = new Error('غير مصرح');
      err.statusCode = 403;
      err.code = 'serverErrors.common.forbidden';
      throw err;
    }
    if (course[field]) {
      const err = new Error('التقرير مفعّل بالفعل على هذه الدورة');
      err.statusCode = 400;
      err.code = 'serverErrors.course.reportAlreadyEnabled';
      throw err;
    }
    const allowed = await permissions.canSubmitElement(user, activeRole, course);
    if (!allowed) {
      const err = new Error('غير مصرح');
      err.statusCode = 403;
      err.code = 'serverErrors.common.forbidden';
      throw err;
    }
    updateData = { [field]: true, [voluntaryField]: true };
  }

  await repo.updateCourseFields(courseId, updateData);

  // تحديث حالة العنصر في عناصر الإقفال
  const element = await repo.findClosureElementByKey(elKey);
  if (element) {
    await repo.updateConditionalTracking(courseId, element.id, enabled ? 'NOT_STARTED' : 'NOT_APPLICABLE');
  }

  await logAudit(user.id, activeRole, 'COURSE_REPORT_TOGGLED', {
    courseId, type, enabled, voluntary: !isManagerOrSupervisor,
  }, courseId);

  // إشعار الموظف المسؤول عند تفعيل التقرير من قِبَل المدير/المشرف
  if (enabled && isManagerOrSupervisor && course.primaryEmployeeId && course.primaryEmployeeId !== user.id) {
    const reportName = type === 'opening' ? 'تقرير افتتاح الدورة' : 'تقرير اختتام الدورة';
    await createNotification(
      course.primaryEmployeeId,
      'ELEMENT_ASSIGNED',
      `تكليف جديد: ${reportName}`,
      `تم تكليفك بتقديم "${reportName}" لدورة "${course.name}" — يُرجى الدخول على الدورة وتقديم التقرير في الموعد المحدد.`,
      { courseId, elementKey: elKey },
    );
  }

  return { success: true, [field]: enabled, [voluntaryField]: updateData[voluntaryField] };
}

// ── تحكم المدير في عناصر الإقفال (revert / exempt / restore) ──────
// منقول حرفياً من pages/api/courses/[id]/override-element.js
const OVERRIDE_ACTIONS = ['revert', 'exempt', 'restore', 'force-reset'];

async function overrideElement(courseId, { trackingId, action, reason }, user, activeRole) {
  if (!trackingId || !OVERRIDE_ACTIONS.includes(action)) {
    const err = new Error('trackingId و action صالح مطلوبان');
    err.statusCode = 400;
    err.code = 'serverErrors.course.overrideTrackingActionRequired';
    throw err;
  }

  if (['revert', 'exempt', 'force-reset'].includes(action) && !reason?.trim()) {
    const err = new Error('السبب مطلوب لهذا الإجراء');
    err.statusCode = 400;
    err.code = 'serverErrors.course.overrideReasonRequired';
    throw err;
  }

  const tracking = await repo.findTrackingWithElement(trackingId);

  if (!tracking || tracking.courseId !== courseId) {
    const err = new Error('العنصر غير موجود');
    err.statusCode = 404;
    err.code = 'serverErrors.closureElements.notFound';
    throw err;
  }

  let data;
  let auditAction;

  if (action === 'revert') {
    if (tracking.status !== 'APPROVED') {
      const err = new Error('لا يمكن استرجاع عنصر غير معتمد');
      err.statusCode = 400;
      err.code = 'serverErrors.course.cannotRevertUnapproved';
      throw err;
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
      const err = new Error('العنصر غير منطبق بالفعل');
      err.statusCode = 400;
      err.code = 'serverErrors.course.alreadyNotApplicable';
      throw err;
    }
    data = {
      status: 'NOT_APPLICABLE',
      overrideReason: reason.trim(),
      overriddenAt: new Date(),
      overriddenById: user.id,
    };
    auditAction = 'CLOSURE_ELEMENT_EXEMPTED';
  } else if (action === 'force-reset') {
    // إعادة فتح أي عنصر بغض النظر عن حالته (للمدير فقط)
    if (tracking.status === 'NOT_APPLICABLE') {
      const err = new Error('استخدم restore لإلغاء الاستثناء');
      err.statusCode = 400;
      err.code = 'serverErrors.course.useRestoreForExemption';
      throw err;
    }
    data = {
      status: 'NOT_STARTED',
      overrideReason: reason.trim(),
      overriddenAt: new Date(),
      overriddenById: user.id,
      executionAt: null,
      executedById: null,
      decisionAt: null,
      decidedById: null,
      rejectionReason: null,
    };
    auditAction = 'CLOSURE_ELEMENT_FORCE_RESET';
  } else {
    if (tracking.status !== 'NOT_APPLICABLE' || !tracking.overriddenById) {
      const err = new Error('لا يمكن استرجاع هذا العنصر');
      err.statusCode = 400;
      err.code = 'serverErrors.course.cannotRestoreElement';
      throw err;
    }
    data = {
      status: 'NOT_STARTED',
      overrideReason: null,
      overriddenAt: null,
      overriddenById: null,
    };
    auditAction = 'CLOSURE_ELEMENT_EXEMPTION_RESTORED';
  }

  const updated = await repo.updateTracking(trackingId, data);

  await logAudit(user.id, activeRole, auditAction, {
    courseId, elementId: tracking.elementId, elementName: tracking.element.name, reason: reason?.trim() || null,
  }, courseId);

  // إعفاء آخر عنصر متبقٍّ يُقفل الدورة فوراً، كما يُقفلها اعتماده
  if (action === 'exempt') {
    await require('../closure/closure.service').checkCourseClosure(courseId);
  }

  return updated;
}

// ── التقارير الاختيارية ─────────────────────────────────────────
// منقول حرفياً من pages/api/courses/[id]/optional-reports.js
async function listOptionalReports(courseId) {
  const course = await repo.findCourseMini(courseId);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    err.code = 'serverErrors.course.notFound';
    throw err;
  }
  return repo.findOptionalReports(courseId);
}

async function createOptionalReport(courseId, { title, content }, user, activeRole) {
  const course = await repo.findCourseMini(courseId);
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    err.code = 'serverErrors.course.notFound';
    throw err;
  }

  // H1: write-authz — يجب أن يكون المستخدم ممن يعملون على الدورة:
  // الموظف الأساسي/عضو الفريق المساند (canSubmitElement) أو مشرف المشروع/المدير (canDecideElement)
  const canAct =
    (await permissions.canSubmitElement(user, activeRole, course)) ||
    (await permissions.canDecideElement(user, activeRole, course));
  if (!canAct) {
    const err = new Error('لا تملك صلاحية إضافة تقرير لهذه الدورة');
    err.statusCode = 403;
    err.code = 'serverErrors.course.optionalReportForbidden';
    throw err;
  }

  if (!content?.trim()) {
    const err = new Error('محتوى التقرير مطلوب');
    err.statusCode = 400;
    err.code = 'serverErrors.course.optionalReportContentRequired';
    throw err;
  }

  return repo.createOptionalReport({
    courseId,
    authorId: user.id,
    title:   title?.trim() || null,
    content: content.trim(),
  });
}

// ── تقرير الملاحظات الميداني (notes-report) ──────────────────────
// منقول حرفياً من pages/api/courses/[id]/notes-report/index.js
async function createNotesReport(courseId, body, user, activeRole) {
  const course = await repo.findCourseForNotesReport(courseId);

  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    err.code = 'serverErrors.course.notFound';
    throw err;
  }

  // H1: write-authz — يجب أن يكون المستخدم ممن يعملون على الدورة وليس مجرد من يستطيع عرضها:
  // الموظف الأساسي/عضو الفريق المساند (canSubmitElement) أو مشرف المشروع/المدير (canDecideElement)
  const canAct =
    (await permissions.canSubmitElement(user, activeRole, course)) ||
    (await permissions.canDecideElement(user, activeRole, course));
  if (!canAct) {
    const err = new Error('غير مصرح لك بإنشاء هذا التقرير');
    err.statusCode = 403;
    err.code = 'serverErrors.fieldReports.createForbidden';
    throw err;
  }

  if (!body.notes || !String(body.notes).trim()) {
    const err = new Error('يرجى كتابة الملاحظات قبل الإرسال');
    err.statusCode = 400;
    err.code = 'serverErrors.fieldReports.notesRequired';
    throw err;
  }

  const formData = {
    notes: String(body.notes).trim(),
    attendanceCount: body.attendanceCount != null && body.attendanceCount !== '' ? Number(body.attendanceCount) : null,
    beneficiaryEntity: body.beneficiaryEntity ? String(body.beneficiaryEntity).trim() : null,
    executingPartner: body.executingPartner ? String(body.executingPartner).trim() : null,
    additionalTrainers: body.additionalTrainers ? String(body.additionalTrainers).trim() : null,
    category: body.category || null,
    priority: body.priority || null,
    suggestedAction: body.suggestedAction ? String(body.suggestedAction).trim() : null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  };

  const report = await repo.createFieldReport({
    courseId: course.id,
    authorId: user.id,
    formData,
  });

  return { id: report.id };
}

module.exports = {
  createCourse,
  findAllCourses,
  findOneCourse,
  updateCourse,
  deleteCourse,
  archiveCourse,
  reassignCourse,
  findArchivedCourses,
  advanceDueCourseLifecycles,
  isValidCourseStatusTransition,
  refreshConditionalElements,
  decideLateEntry,
  listPendingLateEntries,
  toggleOptionalElement,
  toggleReport,
  overrideElement,
  listOptionalReports,
  createOptionalReport,
  createNotesReport,
};
