// خدمة الإشعارات المشتركة
const prisma = require('../db/prisma');

async function createNotification(userId, type, title, message, metadata = null) {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, message, metadata, isRead: false },
    });
  } catch (err) {
    console.error('فشل إنشاء إشعار:', err);
    return null;
  }
}

async function getNotifications(userId, onlyUnread = false, page = 1, limit = 30) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const safePage = Math.max(1, Number(page) || 1);
  const skip = (safePage - 1) * safeLimit;

  const where = { userId, ...(onlyUnread ? { isRead: false } : {}) };
  const [total, data] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: safeLimit,
    }),
  ]);

  return {
    data,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
}

async function markAsRead(id, userId) {
  const notif = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notif) {
    const err = new Error('الإشعار غير موجود');
    err.statusCode = 404;
    throw err;
  }
  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

async function markAllAsRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
};
