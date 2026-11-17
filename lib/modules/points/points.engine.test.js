import { describe, it, expect } from 'vitest';
const engine = require('./points.engine');
const { POINTS: P, levelOf } = require('./points.rules');

const start = new Date('2026-01-01T00:00:00Z');
const end = new Date('2026-12-31T23:59:59Z');
const NOW = new Date('2026-11-17T10:00:00Z');

// عنصر يستحق بعد نهاية الدورة: مثالي ٢٤ ساعة، أقصى ٧٢ ساعة (أيام تقويمية)
const EL = { key: 'materials', name: 'إعادة المواد', deadlineRefPoint: 'COURSE_END', deadlineIdealHours: 24, deadlineMaxHours: 72, isDeadlineWorkingDays: false };
const CRIT = { ...EL, key: 'certificates', name: 'إصدار الشهادات' };

function course(over = {}) {
  return {
    id: 'c1', name: 'دورة', status: 'CLOSED', primaryEmployeeId: 'u1',
    startDate: new Date('2026-10-01T06:00:00Z'), endDate: new Date('2026-10-05T12:00:00Z'),
    createdAt: new Date('2026-09-20T06:00:00Z'), updatedAt: new Date('2026-10-06T06:00:00Z'), closedAt: new Date('2026-10-06T06:00:00Z'),
    closureElements: [], ...over,
  };
}
const tr = (element, over = {}) => ({ id: `t-${element.key}`, status: 'APPROVED', element, blockers: [], executedById: 'u1', ...over });
const ledger = (courses, extra = {}) => engine.buildLedger({ start, end, now: NOW, courses, ...extra });
const sumOf = (entries, uid = 'u1') => engine.summarize(entries.filter((e) => e.userId === uid)).total;

describe('رصيد الإنجاز — العناصر', () => {
  it('قبل المثالي: درجته ومكافأة المبادرة، والحرج ضعفه', () => {
    const c = course({ closureElements: [
      tr(EL, { executionAt: new Date('2026-10-05T20:00:00Z') }),
      tr(CRIT, { executionAt: new Date('2026-10-05T20:00:00Z') }),
    ] });
    const e = ledger([c]).filter((x) => x.category === 'element');
    expect(e.map((x) => x.points).sort((a, b) => a - b)).toEqual([P.elementBase * 1.2, P.elementBase * 2 * 1.2]);
  });

  it('بين المثالي والأقصى: درجته كاملة بلا مكافأة', () => {
    const c = course({ closureElements: [tr(EL, { executionAt: new Date('2026-10-07T12:00:00Z') })] });
    expect(ledger([c]).find((x) => x.category === 'element').points).toBe(P.elementBase);
  });

  it('بعد الأقصى: تنقص يوماً بيوم حتى السالب', () => {
    const late3 = course({ closureElements: [tr(EL, { executionAt: new Date('2026-10-11T12:00:00Z') })] });
    expect(ledger([late3]).find((x) => x.category === 'element').points).toBe(7); // ٣ أيام
    const late30 = course({ closureElements: [tr(EL, { executionAt: new Date('2026-11-08T12:00:00Z') })] });
    expect(ledger([late30]).find((x) => x.category === 'element').points).toBe(P.elementBase * P.lateFloorShare);
  });

  it('لم يُقدَّم وفات موعده: يُخصم من منسق الدورة', () => {
    const c = course({ status: 'AWAITING_CLOSURE', closedAt: null, closureElements: [tr(EL, { status: 'NOT_STARTED', executedById: null })] });
    const e = ledger([c]).find((x) => x.category === 'element');
    expect(e.status).toBe('missing');
    expect(e.userId).toBe('u1');
    expect(e.points).toBeLessThan(0);
  });

  it('العنصر غير المنطبق لا له ولا عليه', () => {
    const c = course({ closureElements: [tr(EL, { status: 'NOT_APPLICABLE', executedById: null })] });
    expect(ledger([c]).filter((x) => x.category === 'element')).toHaveLength(0);
  });

  it('العنصر يُحتسب لمن قدّمه', () => {
    const c = course({ closureElements: [tr(EL, { executedById: 'u2', executionAt: new Date('2026-10-05T20:00:00Z') })] });
    expect(ledger([c]).find((x) => x.category === 'element').userId).toBe('u2');
  });

  it('الإعادة والرفض يُخصمان من الجودة', () => {
    const c = course({ closureElements: [tr(EL, { executionAt: new Date('2026-10-05T20:00:00Z') })] });
    const history = new Map([['c1|materials', { returned: 2, rejected: 0 }]]);
    const q = ledger([c], { history }).find((x) => x.category === 'quality');
    expect(q.points).toBe(P.elementBase * P.returnShare * 2);
  });
});

describe('رصيد الإنجاز — الدورة والإقفال', () => {
  it('تنفيذ الدورة وتسجيلها المبكر وإقفالها في موعدها', () => {
    const c = course({ closureElements: [tr(EL, { executionAt: new Date('2026-10-05T20:00:00Z') })] });
    const e = ledger([c]);
    expect(e.find((x) => x.title === 'تنفيذ دورة').points).toBe(P.courseExecuted);
    expect(e.find((x) => x.title === 'تسجيل مبكر').points).toBe(P.earlyRegistration);
    expect(e.find((x) => x.category === 'closure').points).toBe(P.closureOnTime);
  });

  it('الإقفال المتأخر ينقص ٣ عن كل يوم', () => {
    const c = course({ closedAt: new Date('2026-10-13T12:00:00Z'), closureElements: [tr(EL, { executionAt: new Date('2026-10-05T20:00:00Z') })] });
    // الأقصى ٨ أكتوبر ١٢:٠٠ ← ٥ أيام
    expect(ledger([c]).find((x) => x.category === 'closure').points).toBe(P.closureOnTime + P.closureLatePerDay * 5);
  });

  it('دورة لم تُقفل بعد موعدها: خصم يومي حتى ٣٠-', () => {
    const c = course({ status: 'AWAITING_CLOSURE', closedAt: null, closureElements: [tr(EL, { status: 'NOT_STARTED', executedById: null })] });
    expect(ledger([c]).find((x) => x.category === 'closure').points).toBe(P.closureFloor);
  });

  it('دورة مسندة لم تُسجَّل تُخصم بعد انقضاء شهرها', () => {
    const e = ledger([course()], { assignments: [{ userId: 'u1', periodLabel: '2026-10', periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-10-31T23:59:59Z'), assignedCoursesCount: 3 }] });
    expect(e.find((x) => x.title === 'دورات مسندة لم تُسجَّل').points).toBe(P.unregisteredCourse * 2);
  });

  it('الإدخال المتأخر المرفوض يُخصم ولا يُكافأ تسجيله المبكر', () => {
    const c = course({ isLateEntry: true, lateEntryStatus: 'REJECTED', lateEntryDecidedAt: new Date('2026-10-02') });
    const e = ledger([c]);
    expect(e.find((x) => x.title === 'إدخال متأخر').points).toBe(P.lateEntryRejected);
    expect(e.find((x) => x.title === 'تسجيل مبكر')).toBeUndefined();
  });
});

describe('رصيد الإنجاز — التميّز والتعاون والانضباط', () => {
  it('التوثيق درجة، والنجمة تزيدها', () => {
    const base = { ownerId: 'u1', courseId: 'c1', courseName: 'دورة', updatedAt: new Date('2026-10-10') };
    const onlyDoc = ledger([], { documentations: [{ ...base, sessions: 2, photos: 6 }] });
    expect(sumOf(onlyDoc)).toBe(P.documentation);
    const star = ledger([], { documentations: [{ ...base, sessions: 2, photos: 6, starAwarded: true, starAwardedAt: new Date('2026-10-12') }] });
    expect(sumOf(star)).toBe(P.documentation + P.documentationStar);
    const thin = ledger([], { documentations: [{ ...base, sessions: 0, photos: 1 }] });
    expect(sumOf(thin)).toBe(0);
  });

  it('المبادرة: تقديمها واعتمادها وتنفيذها', () => {
    const e = ledger([], { ideas: [{ userId: 'u1', title: 'فكرة', status: 'IMPLEMENTED', createdAt: new Date('2026-03-01'), reviewedAt: new Date('2026-03-10'), implementedAt: new Date('2026-04-01') }] });
    expect(sumOf(e)).toBe(P.ideaSubmitted + P.ideaApproved + P.ideaImplemented);
  });

  it('البلاغ المرفوض يُخصم من رافعه', () => {
    const e = ledger([], { rejectedBlockers: [{ raisedById: 'u1', decidedAt: new Date('2026-11-01'), note: 'غير صحيح' }] });
    expect(sumOf(e)).toBe(P.rejectedBlocker);
  });

  it('سلسلة الالتزام: كل ١٠ عناصر في موعدها +١٠', () => {
    const els = Array.from({ length: 10 }, (_, i) => tr({ ...EL, key: `k${i}` }, { executionAt: new Date('2026-10-05T20:00:00Z') }));
    const e = ledger([course({ closureElements: els })]);
    expect(e.filter((x) => x.title === 'سلسلة التزام')).toHaveLength(1);
  });

  it('ما خارج السنة لا يُحتسب فيها', () => {
    const e = ledger([], { ideas: [{ userId: 'u1', title: 'قديمة', status: 'PENDING', createdAt: new Date('2025-06-01') }] });
    expect(e).toHaveLength(0);
  });

  it('المستويات', () => {
    expect(levelOf(-50).key).toBe('starter');
    expect(levelOf(450).key).toBe('bronze');
    expect(levelOf(450).next.name).toBe('فضي');
    expect(levelOf(5000).next).toBeNull();
  });
});
