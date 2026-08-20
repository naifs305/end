import { describe, it, expect, vi, beforeEach } from 'vitest';

// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./messaging.service');
const repo = require('./messaging.repo');
const notifications = require('../../services/notifications');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = [
  'findUsersForMessaging', 'findUsersForMessagingScoped', 'findScopedRecipientIds',
  'findRequesterContext', 'findProjectSupervisorIds',
  'findInbox', 'findSent', 'findUserById',
  'findActiveRecipients', 'findCourseById', 'createMessage',
  'findRecipientRecord', 'markRecipientRead',
  'findReceivedForConversations', 'findSentForConversations',
  'findReceivedThread', 'findSentThread', 'markThreadRead',
];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
  vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
});

const ACTOR = { userId: 'u1', activeRole: 'EMPLOYEE' };

describe('messaging.service', () => {
  describe('sendMessage', () => {
    it('rejects (400) when no recipients are provided and never creates a message', async () => {
      await expect(
        svc.sendMessage({ recipientIds: [], message: 'مرحبا' }, ACTOR),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.createMessage).not.toHaveBeenCalled();
    });

    it('rejects (400) when some recipients are missing/inactive', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', firstName: 'سند', lastName: 'الحربي', email: 's@x.com' });
      // طُلب مستلمان لكن النشط واحد فقط
      repo.findActiveRecipients.mockResolvedValue([{ id: 'r1', firstName: 'أ', lastName: 'ب' }]);

      await expect(
        svc.sendMessage({ recipientIds: ['r1', 'r2'], message: 'مرحبا' }, ACTOR),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.createMessage).not.toHaveBeenCalled();
    });

    it('M7: a non-manager cannot message a recipient outside their scope (403)', async () => {
      repo.findUserById.mockResolvedValue({ id: 'u1', firstName: 'سند', lastName: 'الحربي', email: 's@x.com' });
      repo.findActiveRecipients.mockResolvedValue([{ id: 'r9', firstName: 'أ', lastName: 'ب' }]);
      repo.findRequesterContext.mockResolvedValue({ operationalProjectId: 'p1', roles: ['EMPLOYEE'] });
      repo.findProjectSupervisorIds.mockResolvedValue([]);
      repo.findScopedRecipientIds.mockResolvedValue(['r1', 'r2']); // r9 ليس ضمن النطاق

      await expect(
        svc.sendMessage({ recipientIds: ['r9'], message: 'مرحبا' }, ACTOR),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(repo.createMessage).not.toHaveBeenCalled();
    });

    it('M7: a manager is unrestricted and may message anyone', async () => {
      repo.findUserById.mockResolvedValue({ id: 'm1', firstName: 'مدير', lastName: '', email: 'm@x.com' });
      repo.findActiveRecipients.mockResolvedValue([{ id: 'r9', firstName: 'أ', lastName: 'ب' }]);
      repo.createMessage.mockResolvedValue({ id: 'msg1' });

      await expect(
        svc.sendMessage({ recipientIds: ['r9'], message: 'مرحبا' }, { userId: 'm1', activeRole: 'MANAGER' }),
      ).resolves.toMatchObject({ id: 'msg1' });
      expect(repo.findScopedRecipientIds).not.toHaveBeenCalled();
    });
  });

  describe('getThread', () => {
    it('marks unread received messages as read', async () => {
      repo.findReceivedThread.mockResolvedValue([
        {
          id: 'rec1',
          isRead: false,
          message: {
            id: 'm1', body: 'نص', subject: 'موضوع', createdAt: new Date(),
            sender: { id: 'o1', firstName: 'أ', lastName: 'ب', email: 'o@x.com', isActive: true },
            course: null,
          },
        },
      ]);
      repo.findSentThread.mockResolvedValue([]);

      const rows = await svc.getThread(ACTOR, 'o1');

      expect(rows).toHaveLength(1);
      expect(rows[0].direction).toBe('in');
      expect(repo.markThreadRead).toHaveBeenCalledWith('u1', ['m1']);
    });

    it('does not mark anything when there are no unread received messages', async () => {
      repo.findReceivedThread.mockResolvedValue([
        {
          id: 'rec1',
          isRead: true,
          message: {
            id: 'm1', body: 'نص', subject: 'موضوع', createdAt: new Date(),
            sender: { id: 'o1', firstName: 'أ', lastName: 'ب', email: 'o@x.com', isActive: true },
            course: null,
          },
        },
      ]);
      repo.findSentThread.mockResolvedValue([]);

      await svc.getThread(ACTOR, 'o1');
      expect(repo.markThreadRead).not.toHaveBeenCalled();
    });
  });
});
