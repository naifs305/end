// =============================================================
// طبقة الوصول للبيانات لوحدة المراسلة (Repository)
// المكان الوحيد الذي يلمس prisma (message / messageRecipient / user / course) ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

const MESSAGING_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  roles: true,
  operationalProjectId: true,
  operationalProject: { select: { id: true, name: true } },
};

// الدليل الكامل — للمدير فقط (يشرف على كل المشاريع)
function findUsersForMessaging(requesterId) {
  return prisma.user.findMany({
    where: { isActive: true, id: { not: requesterId } },
    select: MESSAGING_USER_SELECT,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

// نطاق المراسلة لغير المدير: أعضاء مشروعه + المدراء + مشرفو مشروعه.
function scopedMessagingWhere(requesterId, projectId, supervisorIds) {
  const or = [{ roles: { has: 'MANAGER' } }];
  if (projectId) or.push({ operationalProjectId: projectId });
  if (supervisorIds && supervisorIds.length) or.push({ id: { in: supervisorIds } });
  return { isActive: true, id: { not: requesterId }, OR: or };
}

function findUsersForMessagingScoped(requesterId, projectId, supervisorIds) {
  return prisma.user.findMany({
    where: scopedMessagingWhere(requesterId, projectId, supervisorIds),
    select: MESSAGING_USER_SELECT,
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

function findScopedRecipientIds(requesterId, projectId, supervisorIds) {
  return prisma.user
    .findMany({ where: scopedMessagingWhere(requesterId, projectId, supervisorIds), select: { id: true } })
    .then((rows) => rows.map((r) => r.id));
}

function findRequesterContext(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { operationalProjectId: true, roles: true },
  });
}

function findProjectSupervisorIds(projectId) {
  if (!projectId) return Promise.resolve([]);
  return prisma.projectSupervisor
    .findMany({ where: { operationalProjectId: projectId }, select: { userId: true } })
    .then((rows) => rows.map((r) => r.userId));
}

function findInbox(userId) {
  return prisma.messageRecipient.findMany({
    where: { recipientId: userId },
    include: {
      message: {
        include: {
          sender: { select: { id: true, firstName: true, lastName: true, email: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { message: { createdAt: 'desc' } },
  });
}

function findSent(userId) {
  return prisma.message.findMany({
    where: { senderId: userId },
    include: {
      course: { select: { id: true, name: true, code: true } },
      recipients: {
        include: {
          recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function findUserById(id) {
  return prisma.user.findUnique({ where: { id } });
}

function findActiveRecipients(recipientIds) {
  return prisma.user.findMany({
    where: { id: { in: recipientIds }, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });
}

function findCourseById(id) {
  return prisma.course.findUnique({
    where: { id },
    select: { id: true },
  });
}

function createMessage(senderId, subject, messageText, courseId, recipientIds) {
  return prisma.message.create({
    data: {
      senderId,
      subject,
      body: messageText,
      courseId: courseId || null,
      recipients: { create: recipientIds.map((rid) => ({ recipientId: rid })) },
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, email: true } },
      course: { select: { id: true, name: true, code: true } },
      recipients: {
        include: {
          recipient: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
}

function findRecipientRecord(messageId, userId) {
  return prisma.messageRecipient.findFirst({
    where: { messageId, recipientId: userId },
  });
}

function markRecipientRead(recipientRecordId, userId) {
  return prisma.messageRecipient.update({
    where: { id: recipientRecordId },
    data: { isRead: true, readAt: new Date(), readById: userId },
  });
}

function findReceivedForConversations(userId) {
  return prisma.messageRecipient.findMany({
    where: { recipientId: userId },
    select: {
      isRead: true,
      message: {
        select: {
          id: true,
          body: true,
          subject: true,
          createdAt: true,
          senderId: true,
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: true,
              isActive: true,
              operationalProject: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { message: { createdAt: 'desc' } },
  });
}

function findSentForConversations(userId) {
  return prisma.message.findMany({
    where: { senderId: userId },
    select: {
      id: true,
      body: true,
      subject: true,
      createdAt: true,
      senderId: true,
      recipients: {
        select: {
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              roles: true,
              isActive: true,
              operationalProject: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

function findReceivedThread(userId, otherUserId) {
  return prisma.messageRecipient.findMany({
    where: {
      recipientId: userId,
      message: { senderId: otherUserId },
    },
    select: {
      id: true,
      isRead: true,
      message: {
        select: {
          id: true,
          body: true,
          subject: true,
          createdAt: true,
          sender: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
          course: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { message: { createdAt: 'asc' } },
  });
}

function findSentThread(userId, otherUserId) {
  return prisma.message.findMany({
    where: {
      senderId: userId,
      recipients: { some: { recipientId: otherUserId } },
    },
    select: {
      id: true,
      body: true,
      subject: true,
      createdAt: true,
      recipients: {
        where: { recipientId: otherUserId },
        select: {
          recipient: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
        },
      },
      course: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function markThreadRead(userId, unreadIds) {
  return prisma.messageRecipient.updateMany({
    where: { recipientId: userId, messageId: { in: unreadIds }, isRead: false },
    data: { isRead: true, readAt: new Date(), readById: userId },
  });
}

module.exports = {
  findUsersForMessaging,
  findUsersForMessagingScoped,
  findScopedRecipientIds,
  findRequesterContext,
  findProjectSupervisorIds,
  findInbox,
  findSent,
  findUserById,
  findActiveRecipients,
  findCourseById,
  createMessage,
  findRecipientRecord,
  markRecipientRead,
  findReceivedForConversations,
  findSentForConversations,
  findReceivedThread,
  findSentThread,
  markThreadRead,
};
