import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = require('../../db/prisma');
const repo = require('./courses.repo');

// حفظ الدورة يعيد تقييم شروط عناصرها. كان يعيد المقدَّم والمُعاد إلى «لم يبدأ»
// فيضيع تقديم المنسق — الآن لا يُفعَّل إلا ما كان غير منطبق.
describe('إعادة تقييم العنصر المشروط عند حفظ الدورة', () => {
  let updateMany;
  beforeEach(() => {
    vi.restoreAllMocks();
    updateMany = vi.fn().mockResolvedValue({ count: 1 });
    prisma.courseClosureTracking = { ...(prisma.courseClosureTracking || {}), updateMany };
  });

  it('صار منطبقاً: يُفعَّل غير المنطبق وحده، ولا يمسّ المقدَّم ولا المُعفى بقرار المدير', async () => {
    await repo.updateConditionalTracking('c1', 'e1', 'NOT_STARTED');
    expect(updateMany).toHaveBeenCalledWith({
      where: { courseId: 'c1', elementId: 'e1', status: 'NOT_APPLICABLE', suspensionId: null, overriddenById: null },
      data: { status: 'NOT_STARTED' },
    });
  });

  it('صار غير منطبق: يسقط ما لم يُعتمد', async () => {
    await repo.updateConditionalTracking('c1', 'e1', 'NOT_APPLICABLE');
    expect(updateMany).toHaveBeenCalledWith({
      where: { courseId: 'c1', elementId: 'e1', status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] }, suspensionId: null },
      data: { status: 'NOT_APPLICABLE' },
    });
  });
});
