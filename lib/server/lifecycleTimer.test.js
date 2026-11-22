import { describe, it, expect, vi, beforeEach } from 'vitest';

const courses = require('../modules/courses/courses.service');
const timer = require('./lifecycleTimer');

describe('مؤقّت دورة حياة الدورات', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('يقدّم الحالات ويُقفل المكتمل، ولا يحفظ رصيد السنة عند فتح القائمة', async () => {
    const spy = vi.spyOn(courses, 'advanceDueCourseLifecycles').mockResolvedValue({ toExecution: 1, toAwaitingClosure: 2, closed: 1 });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const out = await timer.refreshLifecycles({ force: true });
    expect(out).toMatchObject({ toAwaitingClosure: 2 });
    expect(spy).toHaveBeenCalledWith({ archive: false });
  });

  it('لا يتكرر خلال خمس دقائق إلا إن أُجبر', async () => {
    const spy = vi.spyOn(courses, 'advanceDueCourseLifecycles').mockResolvedValue({});
    await timer.refreshLifecycles({ force: true });
    await timer.refreshLifecycles();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('خطأ في القاعدة لا يُسقط الطلب', async () => {
    vi.spyOn(courses, 'advanceDueCourseLifecycles').mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(timer.refreshLifecycles({ force: true })).resolves.toBeNull();
  });
});
