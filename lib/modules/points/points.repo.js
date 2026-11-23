// =============================================================
// «رصيد الإنجاز» — جلب ما وقع فعلاً لسنة (Repository)
// كل ما يُحتسب يُقرأ من مصدره الأصلي، فلا رصيد مخزّن يختلف عن الواقع،
// إلا أرصدة السنوات المنقضية تُحفظ كما هي للرجوع إليها.
// =============================================================
const prisma = require('../../db/prisma');

const safe = (p) => p.catch(() => []);
const DAY = 24 * 60 * 60 * 1000;

/** المنسقون الخاضعون للرصيد: النشطون غير المديرين */
function findCoordinators(where = {}) {
  return prisma.user.findMany({
    where: { isActive: true, NOT: { roles: { has: 'MANAGER' } }, roles: { has: 'EMPLOYEE' }, ...where },
    select: {
      id: true, firstName: true, lastName: true, roles: true, isCollaborator: true,
      operationalProjectId: true, operationalProject: { select: { id: true, name: true } },
    },
    orderBy: { firstName: 'asc' },
  });
}

/** دورات السنة ومعها ما يلزم لحساب المواعيد — تمتد قبلها لما يُقفل فيها */
// الحقول اللازمة وحدها — بيانات النماذج (formData) ثقيلة ولا يحتاجها الحساب
function findCourses(start, end) {
  return prisma.course.findMany({
    where: { startDate: { lte: end }, endDate: { gte: new Date(start.getTime() - 200 * DAY) } },
    select: {
      id: true, name: true, status: true, primaryEmployeeId: true, operationalProjectId: true, startDate: true, endDate: true,
      courseType: true, primaryEmployee: { select: { isCollaborator: true, operationalProjectId: true } },
      createdAt: true, updatedAt: true, closedAt: true, entryBaselineAt: true, certificateTypeChangedAt: true,
      isLateEntry: true, lateEntryStatus: true, lateEntryDecidedAt: true,
      closureElements: {
        select: {
          id: true, status: true, executionAt: true, executedById: true, extensionHours: true,
          element: { select: { key: true, name: true, deadlineIdealHours: true, deadlineMaxHours: true, deadlineRefPoint: true, isDeadlineWorkingDays: true } },
          blockers: { select: { isCredited: true, raisedAt: true, resolvedAt: true, status: true } },
        },
      },
    },
  });
}

/** مراجعات شهادات مسندة لم يُرد عليها بعد (لفرص المنسق) */
function findOpenCertReviews() {
  return safe(prisma.courseClosureTracking.findMany({
    where: { element: { key: 'certificates' }, formData: { path: ['certReview', 'status'], equals: 'ASSIGNED' } },
    select: { courseId: true, formData: true, course: { select: { name: true } } },
  }));
}

function findDecisionHistory(courseIds) {
  if (!courseIds.length) return Promise.resolve([]);
  return safe(prisma.auditLog.findMany({
    where: { courseId: { in: courseIds }, action: { in: ['ELEMENT_RETURNED', 'ELEMENT_REJECTED'] } },
    select: { courseId: true, action: true, details: true },
  }));
}

function findDocumentations() {
  return safe(prisma.courseDocumentation.findMany({
    select: {
      courseId: true, updatedAt: true, createdAt: true, starAwarded: true, starAwardedAt: true,
      course: { select: { name: true, primaryEmployeeId: true } },
      sessions: { select: { description: true } },
      _count: { select: { media: true } },
    },
  }));
}

function findCertReviews() {
  return safe(prisma.courseClosureTracking.findMany({
    where: { element: { key: 'certificates' }, formData: { path: ['certReview', 'status'], not: 'ASSIGNED' } },
    select: { courseId: true, formData: true, course: { select: { name: true } } },
  }));
}

function findClosureReviews(start, end) {
  return safe(prisma.closureReview.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { authorId: true, createdAt: true, courseId: true, course: { select: { name: true } } },
  }));
}

function findFieldReports(start, end) {
  return safe(prisma.fieldReport.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { authorId: true, createdAt: true, courseId: true },
  }));
}

function findOptionalReports(start, end) {
  return safe(prisma.courseOptionalReport.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { authorId: true, createdAt: true, title: true, courseId: true, course: { select: { name: true } } },
  }));
}

function findIdeas() {
  return safe(prisma.improvementIdea.findMany({
    select: { userId: true, title: true, status: true, createdAt: true, updatedAt: true, reviewedAt: true, implementedAt: true },
  }));
}

/** شارات منحها المدير بنفسه (التلقائية مشتقة من الأداء فلا تُكرَّر) */
function findManualBadges(start, end) {
  return safe(prisma.employeeBadge.findMany({
    where: { awardedById: { not: null }, awardedAt: { gte: start, lte: end } },
    select: { userId: true, awardedAt: true, badgeType: true, note: true },
  }));
}

function findAssignments(start, end) {
  return safe(prisma.courseAssignmentRegister.findMany({
    where: { periodType: 'MONTHLY', periodStart: { gte: start }, periodEnd: { lte: new Date(end.getTime() + DAY) } },
    select: { userId: true, periodLabel: true, periodStart: true, periodEnd: true, assignedCoursesCount: true },
  }));
}

/** بلاغات رفضها المدير أو المشرف لعدم صحتها */
function findRejectedBlockers(start, end) {
  return safe(prisma.elementBlocker.findMany({
    where: { status: 'CANCELLED', decidedById: { not: null }, decidedAt: { gte: start, lte: end } },
    select: { raisedById: true, raisedAt: true, decidedById: true, decidedAt: true, decisionNote: true, courseId: true, course: { select: { name: true } } },
  }));
}

function findChallenges(start, end) {
  const y = start.getFullYear();
  return safe(prisma.teamChallenge.findMany({
    where: { periodLabel: { startsWith: `${y}-` } },
  }));
}

// ── الإشراف ──
/** المشرفون (غير المديرين) ومشاريعهم، ومن يتابعونه من المتعاونين */
async function findSupervision() {
  const [supervisors, links, followed] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { has: 'PROJECT_SUPERVISOR' }, NOT: { roles: { has: 'MANAGER' } } },
      select: { id: true },
    }),
    safe(prisma.projectSupervisor.findMany({ select: { userId: true, operationalProjectId: true } })),
    prisma.user.findMany({ where: { isCollaborator: true }, select: { id: true, followUpSupervisorId: true } }),
  ]);
  return { supervisorIds: supervisors.map((s) => s.id), links, followed };
}

/** قرارات الاعتماد والإعادة والرفض، وتقديمات العناصر قبلها — لقياس سرعة البتّ */
function findDecisionLogs(start, end) {
  return safe(prisma.auditLog.findMany({
    where: {
      action: { in: ['ELEMENT_SUBMITTED', 'ELEMENT_APPROVED', 'ELEMENT_RETURNED', 'ELEMENT_REJECTED'] },
      createdAt: { gte: new Date(start.getTime() - 60 * DAY), lte: end },
    },
    select: { userId: true, action: true, courseId: true, details: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  }));
}

/** بلاغات بتّ فيها مشرف أو مدير (رفضاً أو قراراً) */
function findBlockerDecisions(start, end) {
  return safe(prisma.elementBlocker.findMany({
    where: { decidedById: { not: null }, decidedAt: { gte: start, lte: end } },
    select: { raisedAt: true, decidedById: true, decidedAt: true, courseId: true, course: { select: { name: true } } },
  }));
}

// ── تقدير المدير في التقييم السنوي ──
function findRatings(year) {
  return safe(prisma.evaluationRating.findMany({ where: { year } }));
}

function upsertRating(year, userId, rating, ratedById) {
  return prisma.evaluationRating.upsert({
    where: { year_userId: { year, userId } },
    create: { year, userId, rating, ratedById },
    update: { rating, ratedById },
  });
}

function deleteRating(year, userId) {
  return prisma.evaluationRating.deleteMany({ where: { year, userId } });
}

// ── أرشيف السنوات ──
function findArchive(year) {
  return safe(prisma.pointsYearArchive.findMany({ where: { year } }));
}

async function saveArchive(year, rows) {
  await prisma.$transaction([
    prisma.pointsYearArchive.deleteMany({ where: { year } }),
    prisma.pointsYearArchive.createMany({ data: rows }),
  ]);
}

function listArchivedYears() {
  return safe(prisma.pointsYearArchive.groupBy({ by: ['year'], _count: { userId: true }, orderBy: { year: 'desc' } }));
}

module.exports = {
  findCoordinators, findCourses, findOpenCertReviews, findDecisionHistory, findDocumentations, findCertReviews,
  findClosureReviews, findFieldReports, findOptionalReports, findIdeas, findManualBadges,
  findAssignments, findRejectedBlockers, findChallenges, findArchive, saveArchive, listArchivedYears,
  findSupervision, findDecisionLogs, findBlockerDecisions, findRatings, upsertRating, deleteRating,
};
