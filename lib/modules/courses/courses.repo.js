// =============================================================
// طبقة الوصول للبيانات لوحدة الدورات (Repository)
// المكان الوحيد الذي يلمس prisma لجداول الدورات ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

const COURSE_FULL_INCLUDE = {
  primaryEmployee: true,
  operationalProject: true,
  supportingTeam: { include: { user: true } },
  closureElements: {
    include: {
      element: true,
      executor: { select: { id: true, firstName: true, lastName: true } },
      decider: { select: { id: true, firstName: true, lastName: true } },
    },
  },
};

function findActiveClosureElements(tx) {
  const db = tx || prisma;
  return db.closureElement.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}

function createClosureTracking(data, tx) {
  const db = tx || prisma;
  return db.courseClosureTracking.createMany({ data, skipDuplicates: true });
}

function findLatestCourseByCodePrefix(prefix, tx) {
  const db = tx || prisma;
  return db.course.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
}

function findConditionalElements() {
  return prisma.closureElement.findMany({
    where: { elementType: 'CONDITIONAL', isActive: true, conditionField: { not: null } },
  });
}

function updateConditionalTracking(courseId, elementId, status) {
  return prisma.courseClosureTracking.updateMany({
    where: { courseId, elementId, status: { notIn: ['APPROVED'] } },
    data: { status },
  });
}

function createCourseTx(data, tx) {
  return tx.course.create({
    data,
    include: {
      primaryEmployee: true,
      operationalProject: true,
      supportingTeam: { include: { user: true } },
      closureElements: {
        include: {
          element: true,
          executor: { select: { id: true, firstName: true, lastName: true } },
          decider: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });
}

function runTransaction(fn, options) {
  return prisma.$transaction(fn, options);
}

function findFullById(id) {
  return prisma.course.findUnique({ where: { id }, include: COURSE_FULL_INCLUDE });
}

function findOneWithAudit(id) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      supportingTeam: { include: { user: true } },
      operationalProject: true,
      closureElements: {
        include: {
          element: true,
          executor: { select: { id: true, firstName: true, lastName: true } },
          decider: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      auditLogs: { take: 15, orderBy: { createdAt: 'desc' }, include: { user: true } },
    },
  });
}

function findByIdRaw(id) {
  return prisma.course.findUnique({ where: { id } });
}

function findByIdWithSupportingTeam(id) {
  return prisma.course.findUnique({ where: { id }, include: { supportingTeam: true } });
}

function findByIdWithPrimaryEmployee(id) {
  return prisma.course.findUnique({ where: { id }, include: { primaryEmployee: true } });
}

function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

function count(where) {
  return prisma.course.count({ where });
}

function findMany(args) {
  return prisma.course.findMany(args);
}

function updateCourseTx(id, data, tx) {
  const db = tx || prisma;
  return db.course.update({ where: { id }, data });
}

function deleteSupportTx(courseId, tx) {
  const db = tx || prisma;
  return db.courseSupport.deleteMany({ where: { courseId } });
}

function createSupportTx(data, tx) {
  const db = tx || prisma;
  return db.courseSupport.createMany({ data, skipDuplicates: true });
}

function reassignPrimaryEmployee(id, primaryEmployeeId) {
  return prisma.course.update({
    where: { id },
    data: { primaryEmployeeId },
    include: { primaryEmployee: true, operationalProject: true },
  });
}

function deleteCourseCascade(id) {
  return prisma.$transaction([
    prisma.courseSupport.deleteMany({ where: { courseId: id } }),
    prisma.courseClosureTracking.deleteMany({ where: { courseId: id } }),
    prisma.auditLog.deleteMany({ where: { courseId: id } }),
    prisma.message.deleteMany({ where: { courseId: id } }),
    prisma.course.delete({ where: { id } }),
  ]);
}

function setStatus(id, status) {
  // نثبّت لحظة الإقفال الفعلي عند الانتقال إلى CLOSED (مرجع حساب تأخر الإقفال)
  const data = status === 'CLOSED' ? { status, closedAt: new Date() } : { status };
  return prisma.course.update({ where: { id }, data });
}

// دورة الحياة التلقائية (المجدول)
function advanceToAwaitingClosure(now) {
  return prisma.course.updateMany({
    where: {
      status: { in: ['PREPARATION', 'EXECUTION'] },
      endDate: { lte: now },
    },
    data: { status: 'AWAITING_CLOSURE' },
  });
}

function advanceToExecution(now) {
  return prisma.course.updateMany({
    where: {
      status: 'PREPARATION',
      startDate: { lte: now },
      endDate: { gt: now },
    },
    data: { status: 'EXECUTION' },
  });
}

// ── toggle-element / override-element / toggle-report ──
function findTrackingWithCourseMini(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: { element: true, course: { select: { id: true, primaryEmployeeId: true } } },
  });
}

function findTrackingWithElement(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: { element: true },
  });
}

function updateTrackingStatus(trackingId, status) {
  return prisma.courseClosureTracking.update({ where: { id: trackingId }, data: { status } });
}

function updateTracking(trackingId, data) {
  return prisma.courseClosureTracking.update({ where: { id: trackingId }, data });
}

function updateCourseFields(courseId, data) {
  return prisma.course.update({ where: { id: courseId }, data });
}

function updateCourseField(courseId, field, value) {
  return prisma.course.update({ where: { id: courseId }, data: { [field]: value } });
}

function findClosureElementByKey(key) {
  return prisma.closureElement.findFirst({ where: { key } });
}

// ── optional-reports ──
function findCourseMini(courseId) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, primaryEmployeeId: true, operationalProjectId: true },
  });
}

function findOptionalReports(courseId) {
  return prisma.courseOptionalReport.findMany({
    where: { courseId },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

function createOptionalReport(data) {
  return prisma.courseOptionalReport.create({
    data,
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
}

// ── notes-report (field report) ──
function findCourseForNotesReport(courseId) {
  return prisma.course.findUnique({
    where: { id: courseId },
    include: { primaryEmployee: true, operationalProject: true },
  });
}

function createFieldReport(data) {
  return prisma.fieldReport.create({ data });
}

module.exports = {
  COURSE_FULL_INCLUDE,
  findActiveClosureElements,
  createClosureTracking,
  findLatestCourseByCodePrefix,
  findConditionalElements,
  updateConditionalTracking,
  createCourseTx,
  runTransaction,
  findFullById,
  findOneWithAudit,
  findByIdRaw,
  findByIdWithSupportingTeam,
  findByIdWithPrimaryEmployee,
  findUserById,
  count,
  findMany,
  updateCourseTx,
  deleteSupportTx,
  createSupportTx,
  reassignPrimaryEmployee,
  deleteCourseCascade,
  setStatus,
  advanceToAwaitingClosure,
  advanceToExecution,
  findTrackingWithCourseMini,
  findTrackingWithElement,
  updateTrackingStatus,
  updateTracking,
  updateCourseField,
  updateCourseFields,
  findClosureElementByKey,
  findCourseMini,
  findOptionalReports,
  createOptionalReport,
  findCourseForNotesReport,
  createFieldReport,
};
