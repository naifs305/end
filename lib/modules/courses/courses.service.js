// =============================================================
// وحدة الدورات — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (permissions) وسجل التدقيق.
// المنطق منقول حرفياً من lib/services/courses.js مع إبقاء جميع
// الحُرّاس ورموز الأخطاء وآثار التدقيق كما هي.
// =============================================================
const repo = require('./courses.repo');
const permissions = require('../../services/permissions');
const { logAudit } = require('../../services/audit');

// دورة حياة الدورة: PREPARATION → EXECUTION → AWAITING_CLOSURE → CLOSED → ARCHIVED
const COURSE_STATUSES = ['PREPARATION', 'EXECUTION', 'AWAITING_CLOSURE', 'CLOSED', 'ARCHIVED'];

const ALLOWED_TRANSITIONS = {
  PREPARATION: ['EXECUTION', 'AWAITING_CLOSURE'],
  EXECUTION: ['AWAITING_CLOSURE'],
  AWAITING_CLOSURE: ['CLOSED', 'EXECUTION'],   // السماح للمدير بإعادتها إلى التنفيذ
  CLOSED: ['ARCHIVED', 'AWAITING_CLOSURE'],     // السماح بإعادة فتح دورة أُقفلت خطأً
  ARCHIVED: [],
};

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
  const allElements = await repo.findActiveClosureElements(tx);

  const data = allElements.map((el) => {
    let status = 'NOT_STARTED';

    if (el.elementType === 'CONDITIONAL' && el.conditionField) {
      status = evaluateCondition(course, el.conditionField) ? 'NOT_STARTED' : 'NOT_APPLICABLE';
    } else if (el.elementType === 'OPTIONAL') {
      // عناصر اختيارية: غير مفعّلة افتراضياً، يفعّلها الموظف لاحقاً عند الحاجة
      status = 'NOT_APPLICABLE';
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
      requiresAdvanceSettlement: !!dto.requiresAdvanceSettlement,
      requiresSupervisorCompensation: !!dto.requiresSupervisorCompensation,
      requiresTrainerCompensation: !!dto.requiresTrainerCompensation,
      requiresPreTest:  !!dto.requiresPreTest,
      requiresPostTest: !!dto.requiresPostTest,
      isCrossProject:   !!dto.isCrossProject,
      // التقارير: خارجية = إجبارية تلقائياً
      requiresOpeningReport: dto.courseType === 'external' ? true : !!dto.requiresOpeningReport,
      requiresClosingReport: dto.courseType === 'external' ? true : !!dto.requiresClosingReport,
      status: 'PREPARATION',
      operationalProject: { connect: { id: dto.operationalProjectId } },
      primaryEmployee: { connect: { id: primaryEmployeeId } },
      supportingTeam: dto.supportingEmployeeIds?.length
        ? { create: dto.supportingEmployeeIds.map((id) => ({ userId: id })) }
        : undefined,
    }, tx);

    await initializeClosureElements(created, tx);
    return created;
  }, { timeout: 30000 }); // 30 ثانية لتجنب timeout مع pgbouncer

  await logAudit(user.id, activeRole, 'COURSE_CREATED', { courseName: course.name }, course.id);

  // أعِد جلب الدورة مع عناصر الإقفال بعد إنشائها
  return repo.findFullById(course.id);
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
        primaryEmployee: { select: { id: true, firstName: true, lastName: true, email: true } },
        operationalProject: { select: { id: true, name: true } },
        supportingTeam: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { closureElements: true } },
        closureElements: { select: { status: true } },
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

  return course;
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
    'requiresAdvance', 'requiresRevenue', 'materialsIssued', 'requiresAdvanceSettlement',
    'requiresSupervisorCompensation', 'requiresTrainerCompensation',
    'requiresPreTest', 'requiresPostTest', 'isCrossProject', 'status',
  ];

  for (const field of fields) {
    if (dto[field] !== undefined) updateData[field] = dto[field];
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
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(activeRole)) {
    const err = new Error('غير مصرح');
    err.statusCode = 403;
    err.code = 'serverErrors.common.forbidden';
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
  const elKey = type === 'opening' ? 'opening_report' : 'closing_report';

  await repo.updateCourseField(courseId, field, enabled);

  // تحديث حالة العنصر في عناصر الإقفال
  const element = await repo.findClosureElementByKey(elKey);
  if (element) {
    await repo.updateConditionalTracking(courseId, element.id, enabled ? 'NOT_STARTED' : 'NOT_APPLICABLE');
  }

  await logAudit(user.id, activeRole, 'COURSE_REPORT_TOGGLED', {
    courseId, type, enabled,
  }, courseId);

  return { success: true, [field]: enabled };
}

// ── تحكم المدير في عناصر الإقفال (revert / exempt / restore) ──────
// منقول حرفياً من pages/api/courses/[id]/override-element.js
const OVERRIDE_ACTIONS = ['revert', 'exempt', 'restore'];

async function overrideElement(courseId, { trackingId, action, reason }, user, activeRole) {
  if (!trackingId || !OVERRIDE_ACTIONS.includes(action)) {
    const err = new Error('trackingId و action صالح مطلوبان');
    err.statusCode = 400;
    err.code = 'serverErrors.course.overrideTrackingActionRequired';
    throw err;
  }

  if (['revert', 'exempt'].includes(action) && !reason?.trim()) {
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
  toggleOptionalElement,
  toggleReport,
  overrideElement,
  listOptionalReports,
  createOptionalReport,
  createNotesReport,
};
