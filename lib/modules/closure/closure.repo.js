// =============================================================
// طبقة الوصول للبيانات لوحدة الإقفال (Repository)
// المكان الوحيد الذي يلمس prisma لجداول الإقفال ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

function findTrackingByCourse(courseId) {
  return prisma.courseClosureTracking.findMany({ where: { courseId } });
}

function setCourseStatus(courseId, status) {
  // نثبّت لحظة الإقفال الفعلي عند الانتقال إلى CLOSED (مرجع حساب تأخر الإقفال)
  const data = status === 'CLOSED' ? { status, closedAt: new Date() } : { status };
  return prisma.course.update({ where: { id: courseId }, data });
}

function findTrackingWithElementAndCourse(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element: true,
      course: { include: { supportingTeam: true } },
    },
  });
}

function findTrackingById(trackingId) {
  return prisma.courseClosureTracking.findUnique({ where: { id: trackingId } });
}

// تحديث ذرّي مشروط بالحالة الحالية — يُرجع عدد الصفوف المتأثرة
function updateManyByStatus(trackingId, allowedStatuses, data) {
  return prisma.courseClosureTracking.updateMany({
    where: { id: trackingId, status: allowedStatuses },
    data,
  });
}

// تحديث ذرّي مشروط بعدم وجود الحالة ضمن مجموعة (notIn)
function updateManyNotInStatus(trackingId, excludedStatuses, data) {
  return prisma.courseClosureTracking.updateMany({
    where: { id: trackingId, status: { notIn: excludedStatuses } },
    data,
  });
}

// ── export / export-eml ──
function findTrackingForExport(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      course: { include: { primaryEmployee: true, operationalProject: true } },
      element: true,
    },
  });
}

// ── extend (المدير فقط) ──
function findTrackingForExtend(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element: true,
      course: { include: { primaryEmployee: true } },
    },
  });
}

function updateTracking(trackingId, data) {
  return prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data,
  });
}

function updateExtension(trackingId, data) {
  return prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data,
    include: { element: true, course: true },
  });
}

// ── إدارة عناصر الإقفال الرئيسية (ClosureElement master) ──
function findAllElements() {
  return prisma.closureElement.findMany({
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

function createElement(data) {
  return prisma.closureElement.create({ data });
}

function findOpenCoursesForElement() {
  return prisma.course.findMany({
    where: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    select: { id: true, requiresAdvance: true, requiresRevenue: true, materialsIssued: true, requiresAdvanceSettlement: true, requiresSupervisorCompensation: true, requiresTrainerCompensation: true, requiresPreTest: true, requiresPostTest: true, requiresOpeningReport: true, requiresClosingReport: true },
  });
}

function createTrackingMany(data) {
  return prisma.courseClosureTracking.createMany({ data, skipDuplicates: true });
}

function findElementById(id) {
  return prisma.closureElement.findUnique({ where: { id } });
}

function updateElement(id, data) {
  return prisma.closureElement.update({ where: { id }, data });
}

module.exports = {
  findTrackingByCourse,
  setCourseStatus,
  findTrackingWithElementAndCourse,
  findTrackingById,
  updateManyByStatus,
  updateManyNotInStatus,
  findTrackingForExport,
  findTrackingForExtend,
  updateExtension,
  updateTracking,
  findAllElements,
  createElement,
  findOpenCoursesForElement,
  createTrackingMany,
  findElementById,
  updateElement,
};
