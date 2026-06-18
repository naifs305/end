// =============================================================
// وحدة المراسلة — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (policy) وخدمة الإشعارات المشتركة.
// تحافظ على السلوك ورموز الحالة الأصلية بالحرف نفسه.
// =============================================================
const repo = require('./messaging.repo');
const policy = require('./messaging.policy');
const { AppError } = require('../../shared/AppError');
// notifications تبقى خدمة مشتركة — نمرّر عبر كائن الوحدة الحيّ ليبقى التجسّس مرئياً في الاختبارات
const notifications = require('../../services/notifications');
const createNotification = (...args) => notifications.createNotification(...args);

function normalizeText(value) {
  return String(value || '').trim();
}

// الأخطاء التشغيلية الأصلية كانت تُرجَع بالرمز العام serverErrors.common.serverError
// لذا نحافظ على نفس الرمز/الحالة هنا.
function legacyError(message, statusCode) {
  return new AppError(message, { code: 'serverErrors.common.serverError', statusCode });
}

// يحلّ نطاق المراسلة للمستخدم: المدير غير مقيَّد؛ غيره مقيَّد بمشروعه + المدراء + مشرفي مشروعه.
async function resolveMessagingScope(actor) {
  if (actor.activeRole === 'MANAGER') return { unrestricted: true };
  const ctx = await repo.findRequesterContext(actor.userId);
  const projectId = ctx?.operationalProjectId || null;
  const supervisorIds = await repo.findProjectSupervisorIds(projectId);
  return { unrestricted: false, projectId, supervisorIds };
}

async function getUsersForMessaging(actor) {
  const scope = await resolveMessagingScope(actor);
  if (scope.unrestricted) return repo.findUsersForMessaging(actor.userId);
  return repo.findUsersForMessagingScoped(actor.userId, scope.projectId, scope.supervisorIds);
}

async function getInbox(actor) {
  return repo.findInbox(actor.userId);
}

async function getSent(actor) {
  return repo.findSent(actor.userId);
}

async function sendMessage(body, actor) {
  const senderId = actor.userId;
  const recipientIds = [...new Set((body.recipientIds || []).filter(Boolean))];
  const messageText = normalizeText(body.message);
  const subject = normalizeText(body.subject) || 'محادثة داخلية';

  if (!recipientIds.length) {
    throw legacyError('يجب اختيار مستلم واحد على الأقل', 400);
  }
  if (!messageText) {
    throw legacyError('نص الرسالة مطلوب', 400);
  }

  const sender = await repo.findUserById(senderId);
  if (!sender) {
    throw legacyError('المرسل غير موجود', 400);
  }

  const recipients = await repo.findActiveRecipients(recipientIds);

  if (recipients.length !== recipientIds.length) {
    throw legacyError('بعض المستلمين غير موجودين أو غير نشطين', 400);
  }

  // فرض نطاق المراسلة على الخادم (لا يكفي إخفاؤهم من الواجهة):
  // غير المدير لا يراسل إلا أعضاء مشروعه أو المدراء أو مشرفي مشروعه.
  const scope = await resolveMessagingScope(actor);
  if (!scope.unrestricted) {
    const allowedIds = new Set(await repo.findScopedRecipientIds(senderId, scope.projectId, scope.supervisorIds));
    if (recipientIds.some((id) => !allowedIds.has(id))) {
      throw legacyError('لا يمكنك مراسلة مستلمين خارج نطاقك', 403);
    }
  }

  if (body.courseId) {
    const courseRecord = await repo.findCourseById(body.courseId);
    if (!courseRecord) {
      throw legacyError('الدورة المرتبطة غير موجودة', 400);
    }
  }

  const createdMessage = await repo.createMessage(senderId, subject, messageText, body.courseId, recipientIds);

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

async function markMessageAsRead(messageId, actor) {
  const recipient = await repo.findRecipientRecord(messageId, actor.userId);

  if (!recipient) {
    throw legacyError('لا تملك صلاحية الوصول لهذه الرسالة', 403);
  }

  return repo.markRecipientRead(recipient.id, actor.userId);
}

async function getConversationList(actor) {
  const userId = actor.userId;
  const [received, sent] = await Promise.all([
    repo.findReceivedForConversations(userId),
    repo.findSentForConversations(userId),
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

async function getThread(actor, otherUserId) {
  const userId = actor.userId;
  const [received, sent] = await Promise.all([
    repo.findReceivedThread(userId, otherUserId),
    repo.findSentThread(userId, otherUserId),
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
    await repo.markThreadRead(userId, unreadIds);
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
