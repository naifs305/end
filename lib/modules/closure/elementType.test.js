import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../db/prisma');
const repo = require('./closure.repo');
const audit = require('../../services/audit');
const svc = require('./closure.service');

const MANAGER = { id: 'm1' };

describe('تغيير نوع العنصر من صفحة عناصر الإقفال', () => {
  let updateMany;
  beforeEach(() => {
    vi.restoreAllMocks();
    updateMany = vi.fn().mockResolvedValue({ count: 3 });
    prisma.courseClosureTracking = { ...(prisma.courseClosureTracking || {}), updateMany };
    prisma.course = { ...(prisma.course || {}), findMany: vi.fn().mockResolvedValue([]) };
    vi.spyOn(audit, 'logAudit').mockResolvedValue(undefined);
    vi.spyOn(repo, 'updateElement').mockImplementation(async (id, data) => ({ id, ...data }));
  });

  it('يرفض نوعاً غير معروف، والمشروط بلا شرط محفوظ', async () => {
    vi.spyOn(repo, 'findElementById').mockResolvedValue({ id: 'e1', elementType: 'MANDATORY', conditionField: null });
    await expect(svc.updateElement('e1', { elementType: 'X' }, MANAGER, 'MANAGER')).rejects.toMatchObject({ statusCode: 400 });
    await expect(svc.updateElement('e1', { elementType: 'CONDITIONAL' }, MANAGER, 'MANAGER')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('للدورات الجديدة وحدها: لا يمسّ الدورات الجارية', async () => {
    vi.spyOn(repo, 'findElementById').mockResolvedValue({ id: 'e1', elementType: 'MANDATORY', conditionField: null });
    const out = await svc.updateElement('e1', { elementType: 'OPTIONAL' }, MANAGER, 'MANAGER');
    expect(out.elementType).toBe('OPTIONAL');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('اختياري على الجارية: يسقط ما لم يُقدَّم فقط', async () => {
    vi.spyOn(repo, 'findElementById').mockResolvedValue({ id: 'e1', elementType: 'MANDATORY', conditionField: null });
    const out = await svc.updateElement('e1', { elementType: 'OPTIONAL', applyToOpen: true }, MANAGER, 'MANAGER');
    expect(updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ elementId: 'e1', status: { in: ['NOT_STARTED', 'RETURNED', 'REJECTED'] }, executionAt: null, suspensionId: null }),
      data: { status: 'NOT_APPLICABLE' },
    });
    expect(out.appliedToOpenCourses).toBe(3);
  });

  it('إجباري على الجارية: يُضاف لما لم تبدأ فقط، بلا أثر رجعي ولا يعيد ما أعفاه المدير', async () => {
    vi.spyOn(repo, 'findElementById').mockResolvedValue({ id: 'e1', elementType: 'OPTIONAL', conditionField: null });
    await svc.updateElement('e1', { elementType: 'MANDATORY', applyToOpen: true }, MANAGER, 'MANAGER');
    const where = updateMany.mock.calls[0][0].where;
    expect(where.course).toMatchObject({ status: 'PREPARATION', startDate: { gt: expect.any(Date) } });
    expect(where).toMatchObject({ status: 'NOT_APPLICABLE', overriddenById: null, suspensionId: null });
  });
});
