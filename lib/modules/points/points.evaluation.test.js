import { describe, it, expect } from 'vitest';
const ev = require('./points.evaluation');
const { POINTS: P } = require('./points.rules');

const el = (points, base = 10, status = 'withinMax') => ({ category: 'element', status, points, base });
const start = new Date('2026-01-01');
const end = new Date('2026-12-31T23:59:59Z');

describe('مؤشر الأداء لا يتأثر بعدد الدورات', () => {
  it('ثلاث دورات متقنة تساوي عشرين متقنة', () => {
    const few = Array.from({ length: 6 }, () => el(10));
    const many = Array.from({ length: 40 }, () => el(10));
    expect(ev.coordinationParts(few, {}).execution).toBe(100);
    expect(ev.coordinationParts(many, {}).execution).toBe(100);
  });

  it('إتقان القليل يتقدّم على الإخلال بالكثير', () => {
    const few = Array.from({ length: 6 }, () => el(10));
    const many = [...Array.from({ length: 20 }, () => el(10)), ...Array.from({ length: 20 }, () => el(-5, 10, 'late'))];
    expect(ev.coordinationParts(few, {}).execution).toBeGreaterThan(ev.coordinationParts(many, {}).execution);
  });

  it('مكافأة المبادرة تعوّض التأخير ولا تتجاوز ١٠٠', () => {
    const parts = ev.coordinationParts([el(12, 10, 'ideal'), el(12, 10, 'ideal'), el(8, 10, 'late')], {});
    expect(parts.execution).toBe(100);
  });

  it('تسجيل الدورات المسندة: ما سُجّل ÷ ما أُسند بعد انقضاء الشهر', () => {
    const courses = [{ primaryEmployeeId: 'u1', startDate: new Date('2026-10-10') }];
    const assignments = [{ userId: 'u1', periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-10-31'), assignedCoursesCount: 4 }];
    expect(ev.coordinationParts([], { assignments, courses, userId: 'u1', now: new Date('2026-11-17') }).registration).toBe(25);
    expect(ev.coordinationParts([], { assignments: [], courses, userId: 'u1' }).registration).toBeNull();
  });
});

describe('التقييم السنوي', () => {
  const settings = { weights: { execution: 45, registration: 8, excellence: 7, manager: 40 }, supervisorShare: 25 };

  it('بلا تقدير المدير: مؤقت، والمكوّن الغائب يُوزَّع وزنه', () => {
    const r = ev.evaluate({ parts: { execution: 80, registration: null, excellence: 80 }, settings });
    expect(r.provisional).toBe(true);
    expect(r.final).toBe(80);
  });

  it('المشرف: تقييمه منسقاً + ربع مؤشر إشرافه، بسقف ١٠٠', () => {
    const parts = { execution: 80, registration: 80, excellence: 80 };
    const coord = ev.evaluate({ parts, managerRating: 80, settings });
    const sup = ev.evaluate({ parts, managerRating: 80, settings, supervision: { index: 60 } });
    expect(coord.final).toBe(80);
    expect(sup.final).toBe(95);
    expect(ev.evaluate({ parts, managerRating: 80, settings, supervision: { index: 100 } }).final).toBe(100);
  });

  it('السلّم الخماسي', () => {
    expect(ev.evaluate({ parts: { execution: 95, registration: 95, excellence: 95 }, managerRating: 95, settings }).rating.grade).toBe(5);
    expect(ev.evaluate({ parts: { execution: 40, registration: 40, excellence: 40 }, managerRating: 40, settings }).rating.grade).toBe(1);
  });
});

describe('الإشراف', () => {
  const decisions = [
    { supervisorId: 's1', submittedAt: new Date('2026-10-01T08:00Z'), decidedAt: new Date('2026-10-01T12:00Z'), elementName: 'أ' },
    { supervisorId: 's1', submittedAt: new Date('2026-10-02T08:00Z'), decidedAt: new Date('2026-10-03T20:00Z'), elementName: 'ب' },
    { supervisorId: 's1', submittedAt: new Date('2026-10-04T08:00Z'), decidedAt: new Date('2026-10-09T08:00Z'), elementName: 'ج' },
  ];

  it('درجات سرعة البتّ', () => {
    const led = ev.supervisionLedger({ supervisorId: 's1', teamCourseIds: [], decisions, start, end });
    expect(led.map((e) => e.points)).toEqual([P.decisionWithinDay, P.decisionWithinTwoDays, P.decisionLatePerDay * 3]);
    expect(led.every((e) => e.category === 'supervision')).toBe(true);
  });

  it('إقفال دورات الفريق في موعدها ومتأخرات الفريق', () => {
    const coordEntries = [
      { category: 'closure', points: P.closureOnTime, courseId: 'c1', date: new Date('2026-10-10'), courseName: 'د١' },
      { category: 'element', status: 'missing', points: -5, courseId: 'c2', date: new Date('2026-10-10'), title: 'عنصر' },
      { category: 'closure', points: P.closureOnTime, courseId: 'other', date: new Date('2026-10-10') },
    ];
    const led = ev.supervisionLedger({ supervisorId: 's1', teamCourseIds: ['c1', 'c2'], coordEntries, start, end });
    expect(led.map((e) => e.points).sort()).toEqual([P.teamMissingElement, P.teamClosureOnTime].sort());
  });

  it('مؤشر الإشراف من السرعة والإقفال والفريق', () => {
    const idx = ev.supervisionIndex({
      decisions, supervisorId: 's1', teamCourseIds: ['c1'],
      coordEntries: [{ category: 'closure', points: P.closureOnTime, courseId: 'c1' }],
      teamExecution: [80, 60],
    });
    expect(idx.speed).toBe(68.3); // (100 + 75 + 30) / 3 — خمسة أيام = 30
    expect(idx.closure).toBe(100);
    expect(idx.team).toBe(70);
    expect(idx.index).toBe(76.7);
  });
});
