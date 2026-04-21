// خدمة الرسائل المشتركة
const prisma = require('../db/prisma');
const { createNotification } = require('./notifications');

async function getUsersForMessaging(requesterId) {
  return prisma.user.findMany({
    where: { isActive: true, id: { not: requesterId } },
    select: {
      id: true, email: true, firstName: true, lastName: true, roles: true,
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

  if (!recipientIds.length) {
    const err = new Error('يجب اختيار مستلم واحد على الأقل');
    err.statusCode = 400;
    throw err;
  }
  if (!body.subject?.trim()) {
    const err = new Error('موضوع الرسالة مطلوب');
    err.statusCode = 400;
    throw err;
  }
  if (!body.message?.trim()) {
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
      subject: body.subject.trim(),
      body: body.message.trim(),
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

  // إشعار لكل مستلم
  for (const recipient of recipients) {
    await createNotification(
      recipient.id, 'MESSAGE',
      'رسالة داخلية جديدة',
      `لديك رسالة جديدة بعنوان: ${body.subject.trim()}`,
      { messageId: createdMessage.id, senderId, senderName: `${sender.firstName} ${sender.lastName}` },
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

module.exports = {
  getUsersForMessaging, getInbox, getSent, sendMessage, markMessageAsRead,
};
