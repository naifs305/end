// =============================================================
// طبقة الوصول لتوثيق الدورات — المكان الوحيد الذي يلمس جداوله
// =============================================================
const prisma = require('../../db/prisma');

const COURSE_SELECT = {
  id: true, name: true, city: true, startDate: true, endDate: true, status: true,
  primaryEmployeeId: true, operationalProjectId: true, numTrainees: true,
  primaryEmployee: { select: { id: true, firstName: true, lastName: true, profileImage: true, isCollaborator: true, followUpSupervisorId: true } },
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

function incrementViews(id) {
  return prisma.courseDocumentation.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => null);
}

module.exports = {
  findCourse, findByCourse, findBySlug, ensure, update, findMedia, nextSortOrder, countMedia,
  createMedia, updateMedia, deleteMedia, reorderMedia, replaceSessions, incrementViews,
};
