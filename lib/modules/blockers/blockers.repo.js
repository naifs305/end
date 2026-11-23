// =============================================================
// طبقة الوصول للبيانات لوحدة بلاغات العوائق (Repository)
// المكان الوحيد الذي يلمس prisma لجدول البلاغات.
// =============================================================
const prisma = require('../../db/prisma');

const BLOCKER_INCLUDE = {
  raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  decidedBy: { select: { id: true, firstName: true, lastName: true } },
  tracking: {
    select: {
      id: true,
      status: true,
      element: { select: { id: true, key: true, name: true } },
    },
  },
  course: {
    select: {
      id: true,
      name: true,
      code: true,
      startDate: true,
      endDate: true,
      operationalProjectId: true,
      primaryEmployeeId: true,
    },
  },
};

// ── سجل المتابعة مع ما يلزم لحساب المواعيد ──────────────────
function findTrackingForBlocker(trackingId) {
  return prisma.courseClosureTracking.findUnique({
    where: { id: trackingId },
    include: {
      element: true,
      blockers: true,
      course: true,
    },
  });
}

function findBlockerById(id) {
  return prisma.elementBlocker.findUnique({
    where: { id },
    include: BLOCKER_INCLUDE,
  });
}

function findOpenBlockerForTracking(trackingId) {
  return prisma.elementBlocker.findFirst({
    where: { trackingId, status: 'OPEN' },
  });
}

function createBlocker(data) {
  return prisma.elementBlocker.create({ data, include: BLOCKER_INCLUDE });
}

function updateBlocker(id, data) {
  return prisma.elementBlocker.update({
    where: { id },
    data,
    include: BLOCKER_INCLUDE,
  });
}

// ── السقف الفصلي ─────────────────────────────────────────────
// يُحتسب على البلاغات المحتسَبة فعلاً في الفصل (لا الملغاة ولا المرفوضة)
function countCreditedInQuarter(userId, quarterKey) {
  return prisma.elementBlocker.count({
    where: {
      raisedById: userId,
      quarterKey,
      isCredited: true,
      status: { not: 'CANCELLED' },
    },
  });
}

function listByUserAndQuarter(userId, quarterKey) {
  return prisma.elementBlocker.findMany({
    where: { raisedById: userId, quarterKey, status: { not: 'CANCELLED' } },
    include: BLOCKER_INCLUDE,
    orderBy: { raisedAt: 'desc' },
  });
}

// ── قوائم العرض ──────────────────────────────────────────────
function listBlockers(where, { take = 200 } = {}) {
  return prisma.elementBlocker.findMany({
    where,
    include: BLOCKER_INCLUDE,
    orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }],
    take,
  });
}

// البلاغات القائمة مجمَّعة للقائمة الأسبوعية
function listOpenBlockers() {
  return prisma.elementBlocker.findMany({
    where: { status: 'OPEN' },
    include: BLOCKER_INCLUDE,
    orderBy: { raisedAt: 'asc' },
  });
}

function markNotified(ids, when) {
  return prisma.elementBlocker.updateMany({
    where: { id: { in: ids } },
    data: { lastNotifiedAt: when },
  });
}

// ── مستلمو الإشعار الرقابي ───────────────────────────────────
// المديرون جميعاً + مشرفو الدورة (والخارجية لمشرف مشروع منسّقها).
// النشر الفوري هو الحارس على صدق البلاغ، فلا يُرفع بلاغ في الظل.
async function findOversightRecipients(course) {
  const permissions = require('../../services/permissions');
  const [managers, supervisorIds] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { has: 'MANAGER' } },
      select: { id: true },
    }),
    course ? permissions.findCourseSupervisorIds(course) : Promise.resolve([]),
  ]);

  const ids = new Set(managers.map((m) => m.id));
  for (const id of supervisorIds) ids.add(id);
  return [...ids];
}

// ── المقارنة والفحص المتقاطع ─────────────────────────────────
// كل بلاغات فترة بعينها، بأقل حقول تكفي للإحصاء
function listForComparison(from, to) {
  return prisma.elementBlocker.findMany({
    where: {
      raisedAt: { gte: from, lte: to },
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      reason: true,
      awaitedParty: true,
      raisedById: true,
      raisedAt: true,
      resolvedAt: true,
      isCredited: true,
      credit: true,
      courseId: true,
      raisedBy: { select: { id: true, firstName: true, lastName: true, operationalProjectId: true } },
      course: { select: { id: true, name: true, code: true, operationalProjectId: true } },
      tracking: { select: { element: { select: { key: true, name: true } } } },
    },
    orderBy: { raisedAt: 'asc' },
  });
}

// عدد الدورات التي أنشأها كل منسق في الفترة — مقام المقارنة
function countCoursesByEmployee(from, to) {
  return prisma.course.groupBy({
    by: ['primaryEmployeeId'],
    where: { createdAt: { gte: from, lte: to } },
    _count: { _all: true },
  });
}

// إغلاق كل بلاغ قائم على عنصر — يُستدعى عند تقديم العنصر
function resolveOpenBlockersForTracking(trackingId, when, tx) {
  const db = tx || prisma;
  return db.elementBlocker.updateMany({
    where: { trackingId, status: 'OPEN' },
    data: { status: 'RESOLVED', resolvedAt: when },
  });
}

module.exports = {
  BLOCKER_INCLUDE,
  findTrackingForBlocker,
  findBlockerById,
  findOpenBlockerForTracking,
  createBlocker,
  updateBlocker,
  countCreditedInQuarter,
  listByUserAndQuarter,
  listBlockers,
  listOpenBlockers,
  findOversightRecipients,
  markNotified,
  listForComparison,
  countCoursesByEmployee,
  resolveOpenBlockersForTracking,
};
