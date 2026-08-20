// =============================================================
// طبقة الوصول للبيانات لوحدة الجدولة (Repository)
// المكان الوحيد الذي يلمس prisma ضمن هذه الوحدة (scheduledJob + قراءات الدورات/العناصر).
// =============================================================
const prisma = require('../../db/prisma');

// --- الدورات المتأخرة ---
function findOverdueCourses(now) {
  return prisma.course.findMany({
    where: {
      endDate: { lt: now },
      status: { notIn: ['CLOSED', 'ARCHIVED'] },
    },
    include: {
      closureElements: { include: { element: true } },
      primaryEmployee: true,
      operationalProject: {
        include: {
          supervisors: { include: { user: true } },
        },
      },
    },
  });
}

// --- العناصر الراكدة ---
function findStaleElements(threeDaysAgo) {
  return prisma.courseClosureTracking.findMany({
    where: {
      status: { in: ['NOT_STARTED', 'RETURNED'] },
      course: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      OR: [
        { decisionAt: { lt: threeDaysAgo } },
        { AND: [{ decisionAt: null }, { course: { createdAt: { lt: threeDaysAgo } } }] },
      ],
    },
    include: {
      element: true,
      course: { include: { primaryEmployee: true } },
    },
    take: 100, // حد أعلى للأمان
  });
}

// --- العناصر المُعادة ---
function findReturnedElements() {
  return prisma.courseClosureTracking.findMany({
    where: {
      status: 'RETURNED',
      decisionAt: { not: null },
      course: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    },
    include: {
      element: true,
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: { include: { supervisors: true } },
        },
      },
    },
  });
}

// --- التأمين الطبي ---
function findInsuranceElement() {
  return prisma.closureElement.findUnique({
    where: { key: 'medical_insurance' },
  });
}

function findPendingInsurance(insuranceElementId, windowStart, windowEnd) {
  return prisma.courseClosureTracking.findMany({
    where: {
      elementId: insuranceElementId,
      status: { in: ['NOT_STARTED', 'RETURNED'] },
      course: {
        courseType: 'external',
        startDate: { gte: windowStart, lte: windowEnd },
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
      },
    },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: {
            include: { supervisors: { include: { user: true } } },
          },
        },
      },
    },
  });
}

function findActiveManagers() {
  return prisma.user.findMany({
    where: { isActive: true, roles: { has: 'MANAGER' } },
    select: { id: true },
  });
}

// --- إدارة المهام ---
function findDueJobs(now) {
  return prisma.scheduledJob.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: { lte: now },
    },
  });
}

function updateJobAfterRun(id, data) {
  return prisma.scheduledJob.update({ where: { id }, data });
}

function findAllJobs() {
  return prisma.scheduledJob.findMany({
    orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
  });
}

function createJob(data) {
  return prisma.scheduledJob.create({ data });
}

function updateJob(id, data) {
  return prisma.scheduledJob.update({ where: { id }, data });
}

function deleteJob(id) {
  return prisma.scheduledJob.delete({ where: { id } });
}

module.exports = {
  findOverdueCourses,
  findStaleElements,
  findReturnedElements,
  findInsuranceElement,
  findPendingInsurance,
  findActiveManagers,
  findDueJobs,
  updateJobAfterRun,
  findAllJobs,
  createJob,
  updateJob,
  deleteJob,
};
