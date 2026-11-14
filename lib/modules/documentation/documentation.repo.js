// =============================================================
// طبقة الوصول لتوثيق الدورات — المكان الوحيد الذي يلمس جداوله
// =============================================================
const prisma = require('../../db/prisma');

const COURSE_SELECT = {
  id: true, name: true, city: true, startDate: true, endDate: true, status: true,
  primaryEmployeeId: true, operationalProjectId: true, numTrainees: true,
  primaryEmployee: { select: { id: true, firstName: true, lastName: true, profileImage: true, signatureImage: true, isCollaborator: true, followUpSupervisorId: true } },
};

function findCourse(courseId) {
  return prisma.course.findUnique({ where: { id: courseId }, select: COURSE_SELECT });
}

function findByCourse(courseId) {
  return prisma.courseDocumentation.findUnique({
    where: { courseId },
    include: {
      media: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      sessions: { orderBy: [{ sortOrder: 'asc' }] },
      trainees: { orderBy: [{ sortOrder: 'asc' }] },
    },
  });
}

function findBySlug(slug) {
  return prisma.courseDocumentation.findUnique({
    where: { slug },
    include: {
      course: { select: COURSE_SELECT },
      media: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
      sessions: { orderBy: [{ sortOrder: 'asc' }] },
    },
  });
}

function ensure(courseId, createdById) {
  return prisma.courseDocumentation.upsert({
    where: { courseId },
    update: {},
    create: { courseId, createdById: createdById || null },
  });
}

function update(id, data) {
  return prisma.courseDocumentation.update({ where: { id }, data });
}

function findMedia(mediaId) {
  return prisma.documentationMedia.findUnique({
    where: { id: mediaId },
    include: { documentation: { select: { id: true, courseId: true, status: true, coverMediaId: true } } },
  });
}

async function nextSortOrder(documentationId) {
  const agg = await prisma.documentationMedia.aggregate({ where: { documentationId }, _max: { sortOrder: true } });
  return (agg._max.sortOrder ?? -1) + 1;
}

function countMedia(documentationId) {
  return prisma.documentationMedia.count({ where: { documentationId } });
}

function createMedia(data) {
  return prisma.documentationMedia.create({ data });
}

function updateMedia(id, data) {
  return prisma.documentationMedia.update({ where: { id }, data });
}

function deleteMedia(id) {
  return prisma.documentationMedia.delete({ where: { id } });
}

function reorderMedia(documentationId, ids) {
  return prisma.$transaction(ids.map((id, i) => prisma.documentationMedia.updateMany({
    where: { id, documentationId },
    data: { sortOrder: i },
  })));
}

function replaceSessions(documentationId, sessions) {
  return prisma.$transaction([
    prisma.documentationSession.deleteMany({ where: { documentationId } }),
    ...sessions.map((s, i) => prisma.documentationSession.create({ data: { ...s, documentationId, sortOrder: i } })),
  ]);
}

function replaceTrainees(documentationId, trainees) {
  return prisma.$transaction([
    prisma.documentationTrainee.deleteMany({ where: { documentationId } }),
    ...trainees.map((t, i) => prisma.documentationTrainee.create({ data: { ...t, documentationId, sortOrder: i } })),
  ]);
}

function findRecentPublished(since) {
  return prisma.courseDocumentation.findMany({
    where: { status: 'PUBLISHED', OR: [{ publishedAt: { gte: since } }, { featuredAt: { gte: since } }] },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take: 6,
    select: { slug: true, featured: true, featuredAt: true, course: { select: { name: true, primaryEmployee: { select: { firstName: true, lastName: true } } } } },
  });
}

function findPublishedSlug(courseId) {
  return prisma.courseDocumentation.findFirst({ where: { courseId, status: 'PUBLISHED' }, select: { slug: true } });
}

function incrementViews(id) {
  return prisma.courseDocumentation.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => null);
}

/** المجلات المنشورة لمكتبة الإصدارات — المميّزة أولاً ثم الأحدث */
function findLibrary({ featuredOnly = false, q = '' } = {}) {
  return prisma.courseDocumentation.findMany({
    where: {
      status: 'PUBLISHED',
      slug: { not: null },
      ...(featuredOnly ? { featured: true } : {}),
      ...(q ? { course: { name: { contains: q, mode: 'insensitive' } } } : {}),
    },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take: 200,
    select: {
      slug: true, featured: true, featuredAt: true, publishedAt: true, views: true, format: true, courseId: true, coverMediaId: true,
      course: { select: { name: true, city: true, startDate: true, endDate: true, primaryEmployee: { select: { id: true, firstName: true, lastName: true, profileImage: true } } } },
      media: { orderBy: [{ sortOrder: 'asc' }], take: 40, select: { id: true, width: true, height: true, edit: true } },
      _count: { select: { media: true } },
    },
  });
}

module.exports = {
  findLibrary,
  findCourse, findByCourse, findBySlug, ensure, update, findMedia, nextSortOrder, countMedia,
  createMedia, updateMedia, deleteMedia, reorderMedia, replaceSessions, incrementViews,
  replaceTrainees, findRecentPublished, findPublishedSlug,
};
