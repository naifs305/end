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

async function getNotifications(userId, onlyUnread = false) {
  return prisma.notification.findMany({
    where: { userId, ...(onlyUnread ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
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
