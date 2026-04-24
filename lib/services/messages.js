const prisma = require('../db/prisma');
const { createNotification } = require('./notifications');

function normalizeText(value) {
  return String(value || '').trim();
}

async function getUsersForMessaging(requesterId) {
  return prisma.user.findMany({
    where: { isActive: true, id: { not: requesterId } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: true,
      operationalProjectId: true,
      operationalProject: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
}

async function getInbox(userId) {
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

async function getSent(userId) {
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

async function sendMessage(senderId, body) {
  const recipientIds = [...new Set((body.recipientIds || []).filter(Boolean))];
  const messageText = normalizeText(body.message);
  const subject = normalizeText(body.subject) || 'محادثة داخلية';

  if (!recipientIds.length) {
    const err = new Error('يجب اختيار مستلم واحد على الأقل');
    err.statusCode = 400;
    throw err;
  }
  if (!messageText) {
    const err = new Error('نص الرسالة مطلوب');
    err.statusCode = 400;
    throw err;
  }

  const sender = await prisma.user.findUnique({ where: { id: senderId } });
  if (!sender) {
    const err = new Error('المرسل غير موجود');
    err.statusCode = 400;
    throw err;
  }

  const recipients = await prisma.user.findMany({
    where: { id: { in: recipientIds }, isActive: true },
    select: { id: true, firstName: true, lastName: true },
  });

  if (recipients.length !== recipientIds.length) {
    const err = new Error('بعض المستلمين غير موجودين أو غير نشطين');
    err.statusCode = 400;
    throw err;
  }

  if (body.courseId) {
    const courseRecord = await prisma.course.findUnique({
      where: { id: body.courseId },
      select: { id: true },
    });
    if (!courseRecord) {
      const err = new Error('الدورة المرتبطة غير موجودة');
      err.statusCode = 400;
      throw err;
    }
  }

  const createdMessage = await prisma.message.create({
    data: {
      senderId,
      subject,
      body: messageText,
      courseId: body.courseId || null,
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

  const senderName = `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || sender.email;

  for (const recipient of recipients) {
    await createNotification(
      recipient.id,
      'MESSAGE',
      'رسالة داخلية جديدة',
      `${senderName}: ${messageText.slice(0, 80)}`,
      { messageId: createdMessage.id, senderId, senderName },
    );
  }

  return createdMessage;
}

async function markMessageAsRead(messageId, userId) {
  const recipient = await prisma.messageRecipient.findFirst({
    where: { messageId, recipientId: userId },
  });

  if (!recipient) {
    const err = new Error('لا تملك صلاحية الوصول لهذه الرسالة');
    err.statusCode = 403;
    throw err;
  }

  return prisma.messageRecipient.update({
    where: { id: recipient.id },
    data: { isRead: true, readAt: new Date(), readById: userId },
  });
}

async function getConversationList(userId) {
  const [received, sent] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: { recipientId: userId },
      include: {
        message: {
          include: {
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
    }),
    prisma.message.findMany({
      where: { senderId: userId },
      include: {
        recipients: {
          include: {
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
    }),
  ]);

  const conversations = new Map();

  for (const item of received) {
    const message = item.message;
    const otherUser = message.sender;
    if (!otherUser || !otherUser.isActive) continue;
    const current = conversations.get(otherUser.id);
    const candidate = {
      user: otherUser,
      lastMessage: {
        id: message.id,
        body: message.body,
        subject: message.subject,
        createdAt: message.createdAt,
        senderId: message.senderId,
      },
      unreadCount: item.isRead ? 0 : 1,
      updatedAt: message.createdAt,
    };

    if (!current) {
      conversations.set(otherUser.id, candidate);
    } else {
      current.unreadCount += item.isRead ? 0 : 1;
      if (new Date(candidate.updatedAt) > new Date(current.updatedAt)) {
        current.lastMessage = candidate.lastMessage;
        current.updatedAt = candidate.updatedAt;
      }
    }
  }

  for (const item of sent) {
    for (const recipientRecord of item.recipients || []) {
      const otherUser = recipientRecord.recipient;
      if (!otherUser || !otherUser.isActive) continue;
      const current = conversations.get(otherUser.id);
      const candidate = {
        user: otherUser,
        lastMessage: {
          id: item.id,
          body: item.body,
          subject: item.subject,
          createdAt: item.createdAt,
          senderId: item.senderId,
        },
        unreadCount: current?.unreadCount || 0,
        updatedAt: item.createdAt,
      };

      if (!current) {
        conversations.set(otherUser.id, candidate);
      } else if (new Date(candidate.updatedAt) > new Date(current.updatedAt)) {
        current.lastMessage = candidate.lastMessage;
        current.updatedAt = candidate.updatedAt;
      }
    }
  }

  return Array.from(conversations.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getThread(userId, otherUserId) {
  const [received, sent] = await Promise.all([
    prisma.messageRecipient.findMany({
      where: {
        recipientId: userId,
        message: { senderId: otherUserId },
      },
      include: {
        message: {
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
            course: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { message: { createdAt: 'asc' } },
    }),
    prisma.message.findMany({
      where: {
        senderId: userId,
        recipients: { some: { recipientId: otherUserId } },
      },
      include: {
        recipients: {
          where: { recipientId: otherUserId },
          include: {
            recipient: { select: { id: true, firstName: true, lastName: true, email: true, isActive: true } },
          },
        },
        course: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const rows = [];
  const otherUserIsActive = received.every((item) => item.message?.sender?.isActive !== false) && sent.every((item) => (item.recipients || []).every((recipientRecord) => recipientRecord.recipient?.isActive !== false));
  if (!otherUserIsActive) return [];

  for (const item of received) {
    rows.push({
      id: item.message.id,
      body: item.message.body,
      subject: item.message.subject,
      createdAt: item.message.createdAt,
      direction: 'in',
      isRead: item.isRead,
      recipientRecordId: item.id,
      sender: item.message.sender,
      course: item.message.course || null,
    });
  }

  for (const item of sent) {
    rows.push({
      id: item.id,
      body: item.body,
      subject: item.subject,
      createdAt: item.createdAt,
      direction: 'out',
      isRead: true,
      recipientRecordId: null,
      sender: null,
      course: item.course || null,
    });
  }

  rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const unreadIds = received.filter((item) => !item.isRead).map((item) => item.message.id);
  if (unreadIds.length) {
    await prisma.messageRecipient.updateMany({
      where: { recipientId: userId, messageId: { in: unreadIds }, isRead: false },
      data: { isRead: true, readAt: new Date(), readById: userId },
    });
  }

  return rows;
}

module.exports = {
  getUsersForMessaging,
  getInbox,
  getSent,
  sendMessage,
  markMessageAsRead,
  getConversationList,
  getThread,
};
