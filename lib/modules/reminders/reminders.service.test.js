import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../db/prisma');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const notifications = require('../../services/notifications');
const svc = require('./reminders.service');

const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
// عنصر يُستحق بعد نهاية الدورة: مثالي يوم، أقصى ثلاثة أيام
const EL = { key: 'materials', name: 'إعادة المواد', deadlineRefPoint: 'END', deadlineIdealHours: 24, deadlineMaxHours: 72, isDeadlineWorkingDays: false };

function course(over = {}) {
  return {
    id: 'c1', name: 'دورة', status: 'AWAITING_CLOSURE', operationalProjectId: 'p1', primaryEmployeeId: 'u1',
    startDate: daysAgo(15), endDate: daysAgo(10),
    primaryEmployee: { id: 'u1', firstName: 'منسق', lastName: 'أ', isActive: true, isCollaborator: false },
    closureElements: [{ id: 't1', status: 'NOT_STARTED', element: EL, blockers: [] }],
    ...over,
  };
}

describe('العناصر المعلّقة', () => {
  it('ما فات موعده الأقصى يُذكر بتأخره', () => {
    const items = svc.pendingElements(course());
    expect(items).toHaveLength(1);
    expect(items[0].lateDays).toBeGreaterThan(0);
    expect(items[0].line).toContain('متأخر');
  });

  it('ما لم يحلّ موعده المثالي لا يُذكَّر به، والمُعاد يُذكَّر به دائماً', () => {
    const fresh = course({ endDate: new Date(NOW.getTime() + 5 * 86400000) });
    expect(svc.pendingElements(fresh)).toHaveLength(0);
    const returned = course({ endDate: new Date(NOW.getTime() + 5 * 86400000), closureElements: [{ id: 't1', status: 'RETURNED', element: EL, blockers: [] }] });
    expect(svc.pendingElements(returned)[0].line).toContain('أُعيد للتصحيح');
  });

  it('المتوقّف ببلاغ عائق قائم لا يُذكَّر به', () => {
    const blocked = course({ closureElements: [{ id: 't1', status: 'NOT_STARTED', element: EL, blockers: [{ status: 'OPEN', isCredited: true, raisedAt: daysAgo(12) }] }] });
    expect(svc.pendingElements(blocked)).toHaveLength(0);
  });
});

describe('تذكير منسق الدورة', () => {
  let msgCreate;
  beforeEach(() => {
    vi.restoreAllMocks();
    msgCreate = vi.fn().mockResolvedValue({ id: 'm1' });
    prisma.message = { ...(prisma.message || {}), create: msgCreate };
    prisma.auditLog = { ...(prisma.auditLog || {}), findFirst: vi.fn().mockResolvedValue(null) };
    prisma.user = { ...(prisma.user || {}), findUnique: vi.fn().mockResolvedValue({ firstName: 'مشرف', lastName: 'ب', email: 'x' }) };
    vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
    vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
  });

  it('المشرف يذكّر منسق دورة مشروعه: رسالة وإشعار وتسجيل', async () => {
    prisma.course = { ...(prisma.course || {}), findUnique: vi.fn().mockResolvedValue(course()) };
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
    const out = await svc.remindCourse('c1', { note: 'قبل الخميس' }, { id: 's1' }, 'PROJECT_SUPERVISOR');
    expect(out).toMatchObject({ sent: 1, items: 1 });
    expect(msgCreate.mock.calls[0][0].data.recipients.create[0].recipientId).toBe('u1');
    expect(msgCreate.mock.calls[0][0].data.body).toContain('قبل الخميس');
    expect(notifications.createNotification).toHaveBeenCalledWith('u1', 'COORDINATOR_REMINDER', expect.any(String), expect.any(String), expect.any(Object));
    expect(audit.logAudit).toHaveBeenCalledWith('s1', 'PROJECT_SUPERVISOR', 'COORDINATOR_REMINDED', expect.any(Object), 'c1');
  });

  it('مشرف مشروع آخر والمنسق لا يذكّران', async () => {
    prisma.course = { ...(prisma.course || {}), findUnique: vi.fn().mockResolvedValue(course()) };
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(false);
    await expect(svc.remindCourse('c1', {}, { id: 's2' }, 'PROJECT_SUPERVISOR')).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.remindCourse('c1', {}, { id: 'u9' }, 'EMPLOYEE')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('مرة في اليوم للدورة الواحدة', async () => {
    prisma.course = { ...(prisma.course || {}), findUnique: vi.fn().mockResolvedValue(course()) };
    prisma.auditLog.findFirst = vi.fn().mockResolvedValue({ createdAt: new Date(Date.now() - 3600000) });
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
    await expect(svc.remindCourse('c1', {}, { id: 's1' }, 'PROJECT_SUPERVISOR')).rejects.toMatchObject({ statusCode: 400 });
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it('لا تذكير بلا عناصر معلّقة', async () => {
    prisma.course = { ...(prisma.course || {}), findUnique: vi.fn().mockResolvedValue(course({ closureElements: [] })) };
    vi.spyOn(permissions, 'canDecideElement').mockResolvedValue(true);
    await expect(svc.remindCourse('c1', {}, { id: 's1' }, 'PROJECT_SUPERVISOR')).rejects.toMatchObject({ statusCode: 400 });
  });
});
