const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const permissions = require('./permissions');

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
  const db = tx || prisma;
  const allElements = await db.closureElement.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });

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

  await db.courseClosureTracking.createMany({ data, skipDuplicates: true });
}

async function generateCourseCode(tx) {
  const year = new Date().getFullYear();
  const prefix = `od-${year}-`;
  const latest = await tx.course.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastNumber = Number.parseInt(latest?.code?.slice(prefix.length) || '0', 10) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
}

async function refreshConditionalElements(courseId, data) {
  const elements = await prisma.closureElement.findMany({
    where: { elementType: 'CONDITIONAL', isActive: true, conditionField: { not: null } },
  });

  for (const el of elements) {
    const field = fieldNameOf(el.conditionField);
    if (data[field] === undefined) continue;

    const applicable = evaluateCondition(data, el.conditionField);

    await prisma.courseClosureTracking.updateMany({
      where: { courseId, elementId: el.id, status: { notIn: ['APPROVED'] } },
      data: { status: applicable ? 'NOT_STARTED' : 'NOT_APPLICABLE' },
    });
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

  const course = await prisma.$transaction(async (tx) => {
    const code = await generateCourseCode(tx);
    const created = await tx.course.create({
      data: {
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
      },
      include: {
        primaryEmployee: true,
        operationalProject: true,
        supportingTeam: { include: { user: true } },
        closureElements: { include: { element: true, executor: { select: { id:true, firstName:true, lastName:true } }, decider: { select: { id:true, firstName:true, lastName:true } } } },
      },
    });

    await initializeClosureElements(created, tx);
    return created;
  }, { timeout: 30000 }); // 30 ثانية لتجنب timeout مع pgbouncer

  await logAudit(user.id, activeRole, 'COURSE_CREATED', { courseName: course.name }, course.id);

  // أعِد جلب الدورة مع عناصر الإقفال بعد إنشائها
  return prisma.course.findUnique({
    where: { id: course.id },
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
      closureElements: {
        include: {
          element: true,
          executor:  { select: { id: true, firstName: true, lastName: true } },
          decider:   { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
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
    prisma.course.count({ where }),
    prisma.course.findMany({
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
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      supportingTeam: { include: { user: true } },
      operationalProject: true,
      closureElements: { include: { element: true, executor: { select: { id:true, firstName:true, lastName:true } }, decider: { select: { id:true, firstName:true, lastName:true } } } },
      auditLogs: { take: 15, orderBy: { createdAt: 'desc' }, include: { user: true } },
    },
  });

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
  const course = await prisma.course.findUnique({
    where: { id },
    include: { supportingTeam: true },
  });

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

  await prisma.$transaction(async (tx) => {
    await tx.course.update({ where: { id }, data: updateData });

    if (dto.supportingEmployeeIds !== undefined) {
      await tx.courseSupport.deleteMany({ where: { courseId: id } });
      if (dto.supportingEmployeeIds.length) {
        await tx.courseSupport.createMany({
          data: dto.supportingEmployeeIds.map((userId) => ({ courseId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
  });

  await refreshConditionalElements(id, dto);
  await logAudit(user.id, activeRole, 'COURSE_UPDATED', { courseId: id }, id);
  return findOneCourse(id, user, activeRole === 'EMPLOYEE' ? 'EMPLOYEE' : activeRole);
}

async function deleteCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({ where: { id } });
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

  await prisma.$transaction([
    prisma.courseSupport.deleteMany({ where: { courseId: id } }),
    prisma.courseClosureTracking.deleteMany({ where: { courseId: id } }),
    prisma.auditLog.deleteMany({ where: { courseId: id } }),
    prisma.message.deleteMany({ where: { courseId: id } }),
    prisma.course.delete({ where: { id } }),
  ]);

  return { success: true };
}

async function archiveCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({ where: { id } });
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

  await prisma.course.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await logAudit(user.id, activeRole, 'COURSE_ARCHIVED', { courseId: id }, id);
  return { success: true };
}

async function reassignCourse(id, newPrimaryEmployeeId, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { primaryEmployee: true },
  });

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

  const newEmployee = await prisma.user.findUnique({ where: { id: newPrimaryEmployeeId } });
  if (!newEmployee) {
    const err = new Error('الموظف الجديد غير موجود');
    err.statusCode = 400;
    throw err;
  }

  const updated = await prisma.course.update({
    where: { id },
    data: { primaryEmployeeId: newPrimaryEmployeeId },
    include: { primaryEmployee: true, operationalProject: true },
  });

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

  return prisma.course.findMany({
    where,
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
      closureElements: { include: { element: true, executor: { select: { id:true, firstName:true, lastName:true } }, decider: { select: { id:true, firstName:true, lastName:true } } } },
    },
    orderBy: { endDate: 'desc' },
  });
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
};
