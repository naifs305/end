import { describe, it, expect } from 'vitest';

const {
  addDeadlineHours,
  mergedPauseHours,
  computeElementDeadlines,
  calcElementTimeScore,
} = require('./deadlines');

const H = 1000 * 60 * 60;

// الأحد 2026-11-01 الساعة 08:00 — getDay() === 0
const SUNDAY = new Date('2026-11-01T08:00:00.000Z');

// عنصر ينتهي بعد نهاية الدورة: مثالي 24 ساعة، أقصى 72 ساعة
function element(overrides = {}) {
  return {
    key: 'certificates',
    deadlineRefPoint: 'END',
    deadlineIdealHours: 24,
    deadlineMaxHours: 72,
    isDeadlineWorkingDays: false,
    ...overrides,
  };
}

function course(overrides = {}) {
  return {
    id: 'c1',
    startDate: new Date('2026-11-01T08:00:00.000Z'),
    endDate: new Date('2026-11-05T08:00:00.000Z'),
    ...overrides,
  };
}

function tracking(overrides = {}) {
  return { element: element(), blockers: [], extensionHours: null, executionAt: null, ...overrides };
}

function blocker(raisedAt, resolvedAt, overrides = {}) {
  return {
    raisedAt: new Date(raisedAt),
    resolvedAt: resolvedAt ? new Date(resolvedAt) : null,
    status: resolvedAt ? 'RESOLVED' : 'OPEN',
    isCredited: true,
    ...overrides,
  };
}

describe('addDeadlineHours — أيام العمل', () => {
  it('يجمع الساعات تقويمياً في الوضع الافتراضي', () => {
    expect(addDeadlineHours(SUNDAY, 48, false).getTime()).toBe(SUNDAY.getTime() + 48 * H);
  });

  it('يتخطّى الجمعة والسبت في وضع أيام العمل', () => {
    const calendar = addDeadlineHours(SUNDAY, 120, false);
    const working = addDeadlineHours(SUNDAY, 120, true);
    expect(working.getTime()).toBeGreaterThan(calendar.getTime());
  });

  it('الساعات السالبة تُجمع تقويمياً حتى في وضع أيام العمل', () => {
    expect(addDeadlineHours(SUNDAY, -72, true).getTime()).toBe(SUNDAY.getTime() - 72 * H);
  });

  it('استهلاك الساعات على دفعتين يساوي استهلاكها دفعة واحدة', () => {
    const once = addDeadlineHours(SUNDAY, 100, true);
    const twice = addDeadlineHours(addDeadlineHours(SUNDAY, 40, true), 60, true);
    expect(twice.getTime()).toBe(once.getTime());
  });
});

describe('mergedPauseHours — دمج فترات البلاغات', () => {
  const now = new Date('2026-11-20T08:00:00.000Z');
  const far = new Date('2026-12-31T00:00:00.000Z');

  it('يجمع بلاغاً مغلقاً واحداً', () => {
    const b = [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z')];
    expect(mergedPauseHours(b, now, far)).toBe(48);
  });

  it('البلاغ المفتوح يمتدّ إلى اللحظة الحالية', () => {
    const b = [blocker('2026-11-18T08:00:00.000Z', null)];
    expect(mergedPauseHours(b, now, far)).toBe(48);
  });

  it('لا يحتسب التداخل مرتين', () => {
    const b = [
      blocker('2026-11-05T08:00:00.000Z', '2026-11-08T08:00:00.000Z'), // 72
      blocker('2026-11-06T08:00:00.000Z', '2026-11-09T08:00:00.000Z'), // متداخل
    ];
    // الاتحاد: من 05 إلى 09 = 96 ساعة
    expect(mergedPauseHours(b, now, far)).toBe(96);
  });

  it('يجمع الفترات المنفصلة', () => {
    const b = [
      blocker('2026-11-05T08:00:00.000Z', '2026-11-06T08:00:00.000Z'), // 24
      blocker('2026-11-10T08:00:00.000Z', '2026-11-12T08:00:00.000Z'), // 48
    ];
    expect(mergedPauseHours(b, now, far)).toBe(72);
  });

  it('يتجاهل البلاغ غير المحتسَب', () => {
    const b = [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z', { isCredited: false })];
    expect(mergedPauseHours(b, now, far)).toBe(0);
  });

  it('يتجاهل البلاغ الملغى', () => {
    const b = [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z', { status: 'CANCELLED' })];
    expect(mergedPauseHours(b, now, far)).toBe(0);
  });

  it('يتجاهل البلاغ المرفوع بعد الحد المسموح', () => {
    const b = [blocker('2026-11-15T08:00:00.000Z', '2026-11-17T08:00:00.000Z')];
    expect(mergedPauseHours(b, now, new Date('2026-11-10T08:00:00.000Z'))).toBe(0);
  });
});

describe('computeElementDeadlines — الموعدان', () => {
  it('يحسب الموعدين من نهاية الدورة', () => {
    const d = computeElementDeadlines(tracking(), course());
    expect(d.hasDeadline).toBe(true);
    expect(d.idealDeadline.toISOString()).toBe('2026-11-06T08:00:00.000Z'); // +24
    expect(d.maxDeadline.toISOString()).toBe('2026-11-08T08:00:00.000Z');   // +72
  });

  it('التمديد يؤجّل الأقصى ولا يؤجّل المثالي', () => {
    const d = computeElementDeadlines(tracking({ extensionHours: 48 }), course());
    expect(d.idealDeadline.toISOString()).toBe('2026-11-06T08:00:00.000Z');
    expect(d.maxDeadline.toISOString()).toBe('2026-11-10T08:00:00.000Z'); // 72 + 48
  });

  it('لا موعد لعنصر بلا نقطة مرجع', () => {
    const d = computeElementDeadlines(tracking({ element: element({ deadlineRefPoint: null }) }), course());
    expect(d.hasDeadline).toBe(false);
  });
});

describe('البلاغ المبكّر يحفظ الموعدين', () => {
  const now = new Date('2026-11-12T08:00:00.000Z');

  it('بلاغ قبل الموعد المثالي يؤجّل المثالي والأقصى معاً', () => {
    // المثالي 11-06، الأقصى 11-08. البلاغ من 11-05 إلى 11-07 = 48 ساعة
    const t = tracking({ blockers: [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z')] });
    const d = computeElementDeadlines(t, course(), now);
    expect(d.idealPauseHours).toBe(48);
    expect(d.maxPauseHours).toBe(48);
    expect(d.idealDeadline.toISOString()).toBe('2026-11-08T08:00:00.000Z');
    expect(d.maxDeadline.toISOString()).toBe('2026-11-10T08:00:00.000Z');
  });

  it('بلاغ بعد المثالي وقبل الأقصى يؤجّل الأقصى وحده', () => {
    // البلاغ من 11-07 (بعد المثالي 11-06، قبل الأقصى 11-08)
    const t = tracking({ blockers: [blocker('2026-11-07T08:00:00.000Z', '2026-11-09T08:00:00.000Z')] });
    const d = computeElementDeadlines(t, course(), now);
    expect(d.idealPauseHours).toBe(0);
    expect(d.maxPauseHours).toBe(48);
    expect(d.idealDeadline.toISOString()).toBe('2026-11-06T08:00:00.000Z'); // كما هو
    expect(d.maxDeadline.toISOString()).toBe('2026-11-10T08:00:00.000Z');
  });

  it('بلاغ بعد الموعد الأقصى لا يؤجّل شيئاً — سدّ باب الادّعاء بأثر رجعي', () => {
    // البلاغ من 11-09، بعد الأقصى 11-08
    const t = tracking({ blockers: [blocker('2026-11-09T08:00:00.000Z', '2026-11-11T08:00:00.000Z')] });
    const d = computeElementDeadlines(t, course(), now);
    expect(d.idealPauseHours).toBe(0);
    expect(d.maxPauseHours).toBe(0);
    expect(d.idealDeadline.toISOString()).toBe('2026-11-06T08:00:00.000Z');
    expect(d.maxDeadline.toISOString()).toBe('2026-11-08T08:00:00.000Z');
  });
});

describe('calcElementTimeScore — الدرجة', () => {
  const now = new Date('2026-11-12T08:00:00.000Z');

  it('100 لمن قدّم في الموعد المثالي', () => {
    const t = tracking({ executionAt: new Date('2026-11-06T00:00:00.000Z') });
    expect(calcElementTimeScore(t, course(), now)).toBe(100);
  });

  it('70 لمن قدّم بعد المثالي وقبل الأقصى', () => {
    const t = tracking({ executionAt: new Date('2026-11-07T00:00:00.000Z') });
    expect(calcElementTimeScore(t, course(), now)).toBe(70);
  });

  it('20 لمن قدّم بعد الأقصى', () => {
    const t = tracking({ executionAt: new Date('2026-11-09T00:00:00.000Z') });
    expect(calcElementTimeScore(t, course(), now)).toBe(20);
  });

  it('0 لمن لم يقدّم وفات الأقصى', () => {
    expect(calcElementTimeScore(tracking(), course(), now)).toBe(0);
  });

  it('لا يُحتسب لمن لم يقدّم ولم يفت موعده', () => {
    const early = new Date('2026-11-07T00:00:00.000Z');
    expect(calcElementTimeScore(tracking(), course(), early)).toBe(null);
  });

  it('بلاغ مبكّر يُنجي المنسق من العقوبة ويحفظ له التميّز', () => {
    // قدّم 11-08 (كان سيأخذ 70)، لكنه أبلغ من 11-05 إلى 11-07
    const t = tracking({
      executionAt: new Date('2026-11-08T00:00:00.000Z'),
      blockers: [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z')],
    });
    expect(calcElementTimeScore(t, course(), now)).toBe(100);
  });

  it('بلاغ متأخر يرفع العقوبة ولا يُعيد التميّز', () => {
    // قدّم 11-09 (كان سيأخذ 20)، وأبلغ من 11-07 (بعد المثالي)
    const t = tracking({
      executionAt: new Date('2026-11-09T12:00:00.000Z'),
      blockers: [blocker('2026-11-07T08:00:00.000Z', '2026-11-09T08:00:00.000Z')],
    });
    expect(calcElementTimeScore(t, course(), now)).toBe(70);
  });

  it('بلاغ بعد فوات الموعد لا يُغيّر الدرجة', () => {
    const t = tracking({
      executionAt: new Date('2026-11-12T00:00:00.000Z'),
      blockers: [blocker('2026-11-09T08:00:00.000Z', '2026-11-11T08:00:00.000Z')],
    });
    expect(calcElementTimeScore(t, course(), now)).toBe(20);
  });

  it('البلاغ غير المحتسَب لا يُنجي أحداً', () => {
    const t = tracking({
      executionAt: new Date('2026-11-08T00:00:00.000Z'),
      blockers: [blocker('2026-11-05T08:00:00.000Z', '2026-11-07T08:00:00.000Z', { isCredited: false })],
    });
    expect(calcElementTimeScore(t, course(), now)).toBe(70);
  });
});

describe('الدورة المُدخلة متأخراً', () => {
  const now = new Date('2026-11-20T08:00:00.000Z');

  // دورة انتهت 11-05، أُدخلت 11-15 — العنصر كان مستحيلاً
  const lateCourse = (status) => course({
    lateEntryStatus: status,
    entryBaselineAt: new Date('2026-11-15T08:00:00.000Z'),
  });

  it('المبرر المقبول يُخرج العنصر المستحيل من الاحتساب', () => {
    const d = computeElementDeadlines(tracking(), lateCourse('ACCEPTED'), now);
    expect(d.excludedFromTiming).toBe(true);
    expect(calcElementTimeScore(tracking(), lateCourse('ACCEPTED'), now)).toBe(null);
  });

  it('المبرر المرفوض يُبقي العقوبة كاملة', () => {
    expect(calcElementTimeScore(tracking(), lateCourse('REJECTED'), now)).toBe(0);
  });

  it('المبرر المعلّق يُبقي العقوبة حتى يُقرَّر', () => {
    expect(calcElementTimeScore(tracking(), lateCourse('PENDING'), now)).toBe(0);
  });

  it('العنصر الذي لم يفت موعده قبل الإدخال يُحتسب عادياً', () => {
    // عنصر مهلته 480 ساعة بعد النهاية — موعده بعد تاريخ الإدخال
    const t = tracking({ element: element({ deadlineIdealHours: 240, deadlineMaxHours: 480 }) });
    const d = computeElementDeadlines(t, lateCourse('ACCEPTED'), now);
    expect(d.excludedFromTiming).toBe(false);
  });
});
