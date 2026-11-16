import { describe, it, expect } from 'vitest';

const ph = require('./projectHistory');

const course = (projectId, start, end) => ({
  operationalProjectId: projectId,
  startDate: new Date(start),
  endDate: new Date(end),
});

describe('تقاطع الدورة مع الفترة', () => {
  const start = new Date('2026-09-01T00:00:00.000Z');
  const end = new Date('2026-09-30T23:59:59.999Z');

  it('دورة داخل الفترة تماماً تتقاطع', () => {
    expect(ph.overlapsPeriod(course('a', '2026-09-05', '2026-09-10'), start, end)).toBe(true);
  });

  it('دورة بدأت قبل الفترة وانتهت داخلها تتقاطع', () => {
    expect(ph.overlapsPeriod(course('a', '2026-08-25', '2026-09-03'), start, end)).toBe(true);
  });

  it('دورة قبل الفترة كلها لا تتقاطع', () => {
    expect(ph.overlapsPeriod(course('a', '2026-07-01', '2026-07-10'), start, end)).toBe(false);
  });

  it('دورة بعد الفترة كلها لا تتقاطع', () => {
    expect(ph.overlapsPeriod(course('a', '2026-10-05', '2026-10-10'), start, end)).toBe(false);
  });

  it('تاريخ غير صحيح لا يُعدّ تقاطعاً', () => {
    expect(ph.overlapsPeriod({ startDate: 'س', endDate: 'ص' }, start, end)).toBe(false);
  });
});

describe('استنتاج المشروع من الدورات', () => {
  it('المشروع الوحيد في الفترة هو المشروع', () => {
    const picked = ph.pickProjectFromCourses(
      [course('proj-a', '2026-09-01', '2026-09-05'), course('proj-a', '2026-09-10', '2026-09-15')],
      'proj-z',
    );
    expect(picked).toBe('proj-a');
  });

  it('عند تعدد المشاريع يفوز صاحب أكثر الدورات — لا الانتماء الحالي', () => {
    const picked = ph.pickProjectFromCourses(
      [course('proj-a', '2026-09-01', '2026-09-05'),
       course('proj-a', '2026-09-06', '2026-09-09'),
       course('proj-b', '2026-09-10', '2026-09-15')],
      'proj-b',
    );
    expect(picked).toBe('proj-a');
  });

  it('عند التساوي يكون الاستنتاج ثابتاً لا عشوائياً', () => {
    const courses = [course('proj-b', '2026-09-01', '2026-09-05'), course('proj-a', '2026-09-10', '2026-09-15')];
    const first = ph.pickProjectFromCourses(courses, null);
    const reversed = ph.pickProjectFromCourses([...courses].reverse(), null);
    expect(first).toBe(reversed);
    expect(first).toBe('proj-a');
  });

  it('بلا دورات في الفترة نرجع للانتماء الحالي', () => {
    expect(ph.pickProjectFromCourses([], 'proj-now')).toBe('proj-now');
  });

  it('بلا دورات وبلا انتماء حالي لا نخمّن', () => {
    expect(ph.pickProjectFromCourses([], null)).toBe(null);
  });

  it('دورة بلا مشروع تُتجاهل ولا تُحتسب', () => {
    expect(ph.pickProjectFromCourses([{ operationalProjectId: null }], 'proj-now')).toBe('proj-now');
  });
});

describe('خطة استرجاع الأشهر الماضية', () => {
  const snapshot = (id, userId, label, start, end, projectId = null) => ({
    id, userId, periodLabel: label,
    periodStart: new Date(start), periodEnd: new Date(end),
    operationalProjectId: projectId,
  });

  it('لا تمسّ لقطة سُجّل عليها مشروع', () => {
    const plan = ph.buildBackfillPlan(
      [snapshot('s1', 'u1', '2026-09', '2026-09-01', '2026-09-30', 'proj-fixed')],
      new Map([['u1', [course('proj-other', '2026-09-02', '2026-09-08')]]]),
      new Map([['u1', 'proj-now']]),
    );
    expect(plan.updates).toHaveLength(0);
  });

  it('المنسق المنقول يبقى شهره الماضي في مشروعه القديم', () => {
    // منسق كان في «أ» في سبتمبر، ثم نُقل إلى «ب»
    const plan = ph.buildBackfillPlan(
      [snapshot('s1', 'u1', '2026-09', '2026-09-01', '2026-09-30')],
      new Map([['u1', [
        course('proj-a', '2026-09-03', '2026-09-07'),
        course('proj-b', '2026-11-03', '2026-11-07'), // بعد النقل — خارج الفترة
      ]]]),
      new Map([['u1', 'proj-b']]), // انتماؤه اليوم
    );

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].operationalProjectId).toBe('proj-a');
    expect(plan.updates[0].source).toBe('COURSES');
    expect(plan.fromCourses).toBe(1);
  });

  it('شهر بلا دورات يُنسب للانتماء الحالي ويُعلَّم بذلك', () => {
    const plan = ph.buildBackfillPlan(
      [snapshot('s1', 'u1', '2026-09', '2026-09-01', '2026-09-30')],
      new Map(),
      new Map([['u1', 'proj-now']]),
    );

    expect(plan.updates[0].operationalProjectId).toBe('proj-now');
    expect(plan.updates[0].source).toBe('CURRENT_MEMBERSHIP');
    expect(plan.fromCurrent).toBe(1);
    expect(plan.fromCourses).toBe(0);
  });

  it('لقطة بلا دليل وبلا انتماء تُترك ولا تُخمَّن', () => {
    const plan = ph.buildBackfillPlan(
      [snapshot('s1', 'u1', '2026-09', '2026-09-01', '2026-09-30')],
      new Map(),
      new Map(),
    );

    expect(plan.updates).toHaveLength(0);
    expect(plan.unresolved).toBe(1);
  });

  it('كل شهر يُنسب لمشروعه هو — لا لمشروع واحد للجميع', () => {
    const plan = ph.buildBackfillPlan(
      [
        snapshot('s1', 'u1', '2026-08', '2026-08-01', '2026-08-31'),
        snapshot('s2', 'u1', '2026-09', '2026-09-01', '2026-09-30'),
      ],
      new Map([['u1', [
        course('proj-a', '2026-08-03', '2026-08-07'),
        course('proj-b', '2026-09-03', '2026-09-07'),
      ]]]),
      new Map([['u1', 'proj-b']]),
    );

    const byId = new Map(plan.updates.map((u) => [u.id, u.operationalProjectId]));
    expect(byId.get('s1')).toBe('proj-a');
    expect(byId.get('s2')).toBe('proj-b');
  });
});

describe('المشروع المنسوب إليه أداء الفترة', () => {
  it('ما سُجّل سلفاً على اللقطة لا يُستبدل بإعادة الاحتساب', () => {
    expect(ph.resolveSnapshotProject(
      'proj-old',
      [course('proj-new', '2026-09-03', '2026-09-07')],
      'proj-new',
    )).toBe('proj-old');
  });

  it('لقطة جديدة لشهر مضى تُنسب لمشروع دورات ذلك الشهر', () => {
    expect(ph.resolveSnapshotProject(
      null,
      [course('proj-old', '2026-09-03', '2026-09-07')],
      'proj-new',
    )).toBe('proj-old');
  });

  it('منسق بلا دورات في الفترة يُنسب لانتمائه الحالي', () => {
    expect(ph.resolveSnapshotProject(null, [], 'proj-new')).toBe('proj-new');
  });

  it('بلا دليل وبلا انتماء لا نخمّن', () => {
    expect(ph.resolveSnapshotProject(null, [], null)).toBe(null);
  });
});
