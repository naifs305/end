// =============================================================
// خدمة الدورات المشتركة (محدّثة للأدوار الثلاثة)
// =============================================================

const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const permissions = require('./permissions');

// --- تهيئة عناصر الإقفال الأربعة عشر عند إنشاء دورة ---
async function initializeClosureElements(course) {
  const allElements = await prisma.closureElement.findMany();

  const data = allElements.map((el) => {
    let status = 'NOT_STARTED';

    if (el.key === 'advance_req' && !course.requiresAdvance) status = 'NOT_APPLICABLE';
    if (el.key === 'settlement' && !course.requiresAdvanceSettlement) status = 'NOT_APPLICABLE';
    if (el.key === 'revenues' && !course.requiresRevenue) status = 'NOT_APPLICABLE';
    if (el.key === 'materials' && !course.materialsIssued) status = 'NOT_APPLICABLE';

    return { courseId: course.id, elementId: el.id, status };
  });

  await prisma.courseClosureTracking.createMany({ data });
}

// --- تحديث حالة العناصر الشرطية ---
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

// --- إنشاء دورة جديدة ---
async function createCourse(dto, user, activeRole) {
  // فحص الصلاحية
  const canCreate = await permissions.canCreateCourseInProject(
    user, activeRole, dto.operationalProjectId,
  );
  if (!canCreate) {
    const err = new Error('لا تملك صلاحية إنشاء دورة في هذا المشروع');
    err.statusCode = 403;
    throw err;
  }

  const course = await prisma.course.create({
    data: {
      name: dto.name,
      code: dto.code,
      beneficiaryEntity: dto.beneficiaryEntity || 'غير محدد',
      city: dto.city,
      locationType: dto.locationType,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      numTrainees: dto.numTrainees,
      courseType: dto.courseType,
      requiresAdvance: !!dto.requiresAdvance,
      requiresRevenue: !!dto.requiresRevenue,
      materialsIssued: !!dto.materialsIssued,
      requiresAdvanceSettlement: !!dto.requiresAdvanceSettlement,
      requiresSupervisorCompensation: !!dto.requiresSupervisorCompensation,
      requiresTrainerCompensation: !!dto.requiresTrainerCompensation,
      status: 'PREPARATION',
      operationalProject: { connect: { id: dto.operationalProjectId } },
      primaryEmployee: { connect: { id: dto.primaryEmployeeId || user.id } },
      supportingTeam:
        dto.supportingEmployeeIds?.length > 0
          ? { create: dto.supportingEmployeeIds.map((id) => ({ userId: id })) }
          : undefined,
    },
    include: {
      supportingTeam: true,
      operationalProject: true,
      primaryEmployee: true,
    },
  });

  await initializeClosureElements(course);
  await logAudit(user.id, activeRole, 'COURSE_CREATED', { courseName: course.name }, course.id);

  return course;
}

// --- قائمة الدورات ---
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

// --- تفاصيل دورة واحدة ---
async function findOneCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      supportingTeam: { include: { user: true } },
      operationalProject: true,
      closureElements: { include: { element: true } },
      auditLogs: { take: 10, orderBy: { createdAt: 'desc' }, include: { user: true } },
    },
  });

  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  const canView = await permissions.canViewCourse(user, activeRole, course);
  if (!canView) {
    const err = new Error('غير مصرح لك بالوصول');
    err.statusCode = 403;
    throw err;
  }

  return course;
}

// --- تحديث دورة ---
async function updateCourse(id, dto, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { supportingTeam: true, closureElements: true },
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
    'name', 'code', 'city', 'locationType', 'numTrainees', 'courseType',
    'requiresAdvance', 'requiresRevenue', 'materialsIssued',
    'requiresAdvanceSettlement', 'requiresSupervisorCompensation', 'requiresTrainerCompensation',
  ];
  for (const f of fields) {
    if (dto[f] !== undefined) updateData[f] = dto[f];
  }
  if (dto.startDate !== undefined) updateData.startDate = new Date(dto.startDate);
  if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
  if (dto.operationalProjectId !== undefined) {
    updateData.operationalProject = { connect: { id: dto.operationalProjectId } };
  }
  if (dto.primaryEmployeeId !== undefined) {
    updateData.primaryEmployee = { connect: { id: dto.primaryEmployeeId } };
  }

  await prisma.$transaction(async (tx) => {
    await tx.course.update({ where: { id }, data: updateData });

    if (dto.supportingEmployeeIds !== undefined) {
      await tx.courseSupport.deleteMany({ where: { courseId: id } });
      if (dto.supportingEmployeeIds.length > 0) {
        await tx.courseSupport.createMany({
          data: dto.supportingEmployeeIds.map((uid) => ({ courseId: id, userId: uid })),
        });
      }
    }
  });

  await refreshConditionalElements(id, {
    requiresAdvance: dto.requiresAdvance,
    requiresAdvanceSettlement: dto.requiresAdvanceSettlement,
    requiresRevenue: dto.requiresRevenue,
    materialsIssued: dto.materialsIssued,
  });

  const updated = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
      closureElements: { include: { element: true } },
    },
  });

  await logAudit(user.id, activeRole, 'COURSE_UPDATED', { courseName: updated?.name }, id);
  return updated;
}

// --- حذف دورة ---
async function deleteCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: { closureElements: true, supportingTeam: true },
  });

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

  await logAudit(user.id, activeRole, 'COURSE_DELETED', { courseName: course.name }, id);

  await prisma.$transaction([
    prisma.courseSupport.deleteMany({ where: { courseId: id } }),
    prisma.courseClosureTracking.deleteMany({ where: { courseId: id } }),
    prisma.auditLog.deleteMany({ where: { courseId: id } }),
    prisma.course.delete({ where: { id } }),
  ]);

  return { success: true, message: 'تم حذف الدورة بنجاح' };
}

// --- أرشفة دورة ---
async function archiveCourse(id, user, activeRole) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) {
    const err = new Error('الدورة غير موجودة');
    err.statusCode = 404;
    throw err;
  }

  const canArchive = await permissions.canArchiveCourse(user, activeRole, course);
  if (!canArchive) {
    const err = new Error('لا تملك صلاحية أرشفة هذه الدورة');
    err.statusCode = 403;
    throw err;
  }

  const updated = await prisma.course.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });
  await logAudit(user.id, activeRole, 'COURSE_ARCHIVED', {}, id);
  return updated;
}

// --- إعادة إسناد دورة ---
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

  const canReassign = await permissions.canReassignCourse(user, activeRole, course);
  if (!canReassign) {
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
    include: {
      primaryEmployee: true,
      operationalProject: true,
      closureElements: { include: { element: true } },
    },
  });

  await logAudit(user.id, activeRole, 'COURSE_REASSIGNED', {
    courseName: course.name,
    fromEmployeeId: course.primaryEmployeeId,
    fromEmployeeName: `${course.primaryEmployee.firstName} ${course.primaryEmployee.lastName}`,
    toEmployeeId: newEmployee.id,
    toEmployeeName: `${newEmployee.firstName} ${newEmployee.lastName}`,
  }, id);

  return updated;
}

// --- الدورات المؤرشفة ---
async function findArchivedCourses(search, user, activeRole) {
  const extraWhere = { status: { in: ['CLOSED', 'ARCHIVED'] } };
  const where = await permissions.buildCoursesWhere(user, activeRole, extraWhere);

  if (search) {
    const searchFilter = {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ],
    };

    if (where.AND) {
      where.AND.push(searchFilter);
    } else if (where.OR) {
      // ندمج الـOR الحالي مع البحث
      where.AND = [{ OR: where.OR }, searchFilter];
      delete where.OR;
    } else {
      where.AND = [searchFilter];
    }
  }

  return prisma.course.findMany({
    where,
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
    },
    orderBy: { updatedAt: 'desc' },
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
