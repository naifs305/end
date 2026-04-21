const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const permissions = require('./permissions');

async function initializeClosureElements(course) {
  const allElements = await prisma.closureElement.findMany({ orderBy: { name: 'asc' } });

  const data = allElements.map((el) => {
    let status = 'NOT_STARTED';

    if (el.key === 'advance_req' && !course.requiresAdvance) status = 'NOT_APPLICABLE';
    if (el.key === 'settlement' && !course.requiresAdvanceSettlement) status = 'NOT_APPLICABLE';
    if (el.key === 'revenues' && !course.requiresRevenue) status = 'NOT_APPLICABLE';
    if (el.key === 'materials' && !course.materialsIssued) status = 'NOT_APPLICABLE';

    return { courseId: course.id, elementId: el.id, status };
  });

  await prisma.courseClosureTracking.createMany({ data, skipDuplicates: true });
}

async function refreshConditionalElements(courseId, data) {
  const keysToUpdate = [
    { key: 'advance_req', value: data.requiresAdvance },
    { key: 'settlement', value: data.requiresAdvanceSettlement },
    { key: 'revenues', value: data.requiresRevenue },
    { key: 'materials', value: data.materialsIssued },
  ];

  for (const item of keysToUpdate) {
    if (typeof item.value !== 'boolean') continue;

    const element = await prisma.closureElement.findFirst({ where: { key: item.key } });
    if (!element) continue;

    await prisma.courseClosureTracking.updateMany({
      where: { courseId, elementId: element.id },
      data: { status: item.value ? 'NOT_STARTED' : 'NOT_APPLICABLE' },
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

  const course = await prisma.course.create({
    data: {
      name: dto.name,
      code: dto.code,
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
      closureElements: { include: { element: true } },
    },
  });

  await initializeClosureElements(course);
  await logAudit(user.id, activeRole, 'COURSE_CREATED', { courseName: course.name }, course.id);
  return course;
}

async function findAllCourses(user, activeRole, projectId, status) {
  const extraWhere = {};
  if (projectId) extraWhere.operationalProjectId = projectId;
  if (status) extraWhere.status = status;

  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);

  return prisma.course.findMany({
    where,
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
      closureElements: { include: { element: true } },
      _count: { select: { closureElements: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function findOneCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      supportingTeam: { include: { user: true } },
      operationalProject: true,
      closureElements: { include: { element: true } },
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
    'requiresSupervisorCompensation', 'requiresTrainerCompensation', 'status',
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
      closureElements: { include: { element: true } },
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
