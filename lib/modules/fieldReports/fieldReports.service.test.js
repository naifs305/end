import { describe, it, expect, vi, beforeEach } from 'vitest';

// require لا import: الخدمة تستعمل require، والتجسّس يرى كائنها نفسه
const svc = require('./fieldReports.service');
const repo = require('./fieldReports.repo');
const notifications = require('../../services/notifications');

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of ['findAll', 'findById', 'findRecent', 'findReportOwner', 'createComment', 'findComment', 'deleteComment']) {
    vi.spyOn(repo, m).mockResolvedValue(undefined);
  }
  vi.spyOn(notifications, 'createNotification').mockResolvedValue(undefined);
});

const ME = { userId: 'u1', activeRole: 'EMPLOYEE' };

describe('التقارير الميدانية — مفتوحة للجميع ويعلّق عليها الزملاء', () => {
  it('القائمة لا تحمل صور المرفقات الثقيلة، بل عددها', () => {
    const out = svc.withoutAttachments({ notes: 'ملاحظة', attachments: ['data:image/png;base64,AAA', 'x'] });
    expect(out).not.toHaveProperty('attachments');
    expect(out.attachmentsCount).toBe(2);
  });

  it('التعليق الفارغ لا يُقبل', async () => {
    await expect(svc.addComment('r1', '   ', ME)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('كاتب التقرير يُشعَر بتعليق زميله', async () => {
    repo.findReportOwner.mockResolvedValue({ id: 'r1', authorId: 'author', course: { name: 'دورة' } });
    repo.createComment.mockResolvedValue({ id: 'c1', author: { firstName: 'أ', lastName: 'ب' } });
    await svc.addComment('r1', 'ملاحظة مفيدة', ME);
    expect(notifications.createNotification).toHaveBeenCalledWith('author', 'FIELD_REPORT_COMMENT', expect.any(String), expect.any(String), { reportId: 'r1' });
  });

  it('ولا يُشعَر بتعليقه هو على تقريره', async () => {
    repo.findReportOwner.mockResolvedValue({ id: 'r1', authorId: 'u1', course: { name: 'دورة' } });
    repo.createComment.mockResolvedValue({ id: 'c1', author: {} });
    await svc.addComment('r1', 'إضافة', ME);
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('يحذف التعليقَ كاتبُه أو المدير، لا غيرهما', async () => {
    repo.findComment.mockResolvedValue({ id: 'c1', authorId: 'someone' });
    await expect(svc.removeComment('c1', ME)).rejects.toMatchObject({ statusCode: 403 });
    await expect(svc.removeComment('c1', { userId: 'm', activeRole: 'MANAGER' })).resolves.toEqual({ id: 'c1' });
    repo.findComment.mockResolvedValue({ id: 'c2', authorId: 'u1' });
    await expect(svc.removeComment('c2', ME)).resolves.toEqual({ id: 'c2' });
  });

  it('تقارير الزملاء الجديدة تظهر في شريط الأخبار برابطها', async () => {
    repo.findRecent.mockResolvedValue([{ id: 'r9', author: { firstName: 'خالد', lastName: 'س' }, course: { name: 'إدارة الحشود' }, _count: { comments: 2 } }]);
    const items = await svc.tickerItems('u1');
    expect(items[0].href).toBe('/field-reports?id=r9');
    expect(items[0].text).toContain('إدارة الحشود');
    expect(repo.findRecent).toHaveBeenCalledWith(expect.any(Date), 'u1');
  });
});
