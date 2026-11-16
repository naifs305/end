import { describe, it, expect } from 'vitest';

const m = require('./kpi.model');

const course = (extra = {}) => ({ id: 'c1', name: 'دورة', startDate: '2026-12-06T00:00:00Z', endDate: '2026-12-10T00:00:00Z', status: 'PREPARATION', ...extra });
// تقرير الاختتام: مثالي يوم، أقصى ٣ أيام تقويمية بعد النهاية (حرج)
const CLOSING = { key: 'closing_report', name: 'تقرير اختتام الدورة', deadlineRefPoint: 'END', deadlineIdealHours: 24, deadlineMaxHours: 72, isDeadlineWorkingDays: false };
// إعادة المواد: الموعدان نفسهما وليس حرجاً
const MATERIALS = { ...CLOSING, key: 'materials', name: 'إعادة المواد' };
const el = (element, extra = {}) => ({ id: Math.random().toString(36), courseId: 'c1', status: 'APPROVED', element, blockers: [], ...extra });
const NOW = new Date('2026-12-20T00:00:00Z');

describe('نموذج المؤشرات ٢ — الالتزام بالمواعيد', () => {
  const c = course();
  it('في المثالي ١٠٠، وحتى الأقصى ٨٠، ثم تنقص ١٠ عن كل يوم', () => {
    expect(m.elementPunctuality(el(MATERIALS, { executionAt: '2026-12-10T10:00:00Z' }), c, NOW)).toMatchObject({ score: 100, status: 'ideal' });
    expect(m.elementPunctuality(el(MATERIALS, { executionAt: '2026-12-12T10:00:00Z' }), c, NOW)).toMatchObject({ score: 80, status: 'withinMax' });
    expect(m.elementPunctuality(el(MATERIALS, { executionAt: '2026-12-15T00:00:00Z' }), c, NOW)).toMatchObject({ score: 60, status: 'late', lateDays: 2 });
  });

  it('غير المقدَّم بعد فوات الأقصى يستمر نقصه حتى الصفر، وقبله لا يُحتسب', () => {
    expect(m.elementPunctuality(el(MATERIALS, { status: 'NOT_STARTED' }), c, NOW)).toMatchObject({ score: 10, status: 'missing', lateDays: 7 });
    expect(m.elementPunctuality(el(MATERIALS, { status: 'NOT_STARTED' }), c, new Date('2027-02-01'))).toMatchObject({ score: 0 });
    expect(m.elementPunctuality(el(MATERIALS, { status: 'NOT_STARTED' }), c, new Date('2026-12-12T00:00:00Z'))).toBeNull();
  });

  it('بلاغ العائق المرفوع قبل الموعد يُزيح الموعد فلا يُخصم', () => {
    const blockers = [{ isCredited: true, status: 'RESOLVED', raisedAt: '2026-12-10T12:00:00Z', resolvedAt: '2026-12-14T12:00:00Z' }];
    expect(m.elementPunctuality(el(MATERIALS, { executionAt: '2026-12-15T00:00:00Z', blockers }), c, NOW).score).toBe(100);
  });

  it('التمديد الممنوح يُزيح الموعد الأقصى', () => {
    expect(m.elementPunctuality(el(MATERIALS, { executionAt: '2026-12-15T00:00:00Z', extensionHours: 72 }), c, NOW)).toMatchObject({ score: 80 });
  });

  it('أيام العمل لا تحتسب الجمعة والسبت', () => {
    // الخميس ← الأحد: يوم عمل واحد فقط (الخميس)
    expect(m.lateDays(new Date(2026, 11, 10, 0, 0), new Date(2026, 11, 13, 0, 0), true)).toBe(1);
    expect(m.lateDays(new Date(2026, 11, 10, 0, 0), new Date(2026, 11, 13, 0, 0), false)).toBe(3);
  });
});

describe('نموذج المؤشرات ٢ — الجودة والإقفال والتميّز', () => {
  it('الجودة: من أول تقديم ١٠٠، أُعيد مرة ٦٠، مرتين ٣٠، رُفض صفر', () => {
    const t = el(MATERIALS, { executionAt: '2026-12-11' });
    expect(m.elementQuality(t, {}).score).toBe(100);
    expect(m.elementQuality(t, { returned: 1 }).score).toBe(60);
    expect(m.elementQuality(t, { returned: 2 }).score).toBe(30);
    expect(m.elementQuality(t, { rejected: 1 }).score).toBe(0);
    expect(m.elementQuality(el(MATERIALS, { status: 'NOT_STARTED' }), {})).toBeNull();
  });

  it('موعد إقفال الدورة أبعد موعد أقصى بين عناصرها المنطبقة', () => {
    const SETTLE = { key: 'settlement', name: 'تسوية', deadlineRefPoint: 'END', deadlineIdealHours: 120, deadlineMaxHours: 240, isDeadlineWorkingDays: false };
    const withAdvance = course({ closureElements: [el(MATERIALS), el(SETTLE)] });
    const noAdvance = course({ closureElements: [el(MATERIALS), el(SETTLE, { status: 'NOT_APPLICABLE' })] });
    expect(m.courseClosureDeadline(withAdvance, NOW).deadline.toISOString()).toBe('2026-12-20T00:00:00.000Z');
    expect(m.courseClosureDeadline(noAdvance, NOW).deadline.toISOString()).toBe('2026-12-13T00:00:00.000Z');
  });

  it('الإقفال: في الموعد ١٠٠، ثم تنقص ١٠ عن كل يوم، والمفتوحة بعد موعدها تنقص كذلك', () => {
    const els = [el(MATERIALS)];
    expect(m.courseClosure(course({ closureElements: els, status: 'CLOSED', closedAt: '2026-12-12T00:00:00Z' }), NOW)).toMatchObject({ score: 100 });
    expect(m.courseClosure(course({ closureElements: els, status: 'CLOSED', closedAt: '2026-12-16T00:00:00Z' }), NOW)).toMatchObject({ score: 70, lateDays: 3 });
    expect(m.courseClosure(course({ closureElements: els }), NOW)).toMatchObject({ score: 30, status: 'open' });
    expect(m.courseClosure(course({ closureElements: els }), new Date('2026-12-12T00:00:00Z'))).toBeNull();
  });
});

describe('نموذج المؤشرات ٢ — الدرجة النهائية', () => {
  it('الأوزان ٦٠/١٠/٢٠/١٠ والعنصر الحرج وزنه مضاعف', () => {
    const c = course({ status: 'CLOSED', closedAt: '2026-12-12T00:00:00Z' });
    const elements = [
      el(CLOSING, { executionAt: '2026-12-10T10:00:00Z' }), // حرج: ١٠٠ ×٢
      el(MATERIALS, { executionAt: '2026-12-15T00:00:00Z' }), // ٦٠
    ];
    c.closureElements = elements;
    const out = m.scoreEmployee({ elements, courses: [c], ownedCourses: [c], now: NOW });
    // الالتزام = (١٠٠×٢ + ٦٠) ÷ ٣ = ٨٦٫٧ · الجودة ١٠٠ · الإقفال (تأخر يومين عن موعد ١٣ ديسمبر؟ لا: أُقفلت ١٢) ١٠٠ · التميّز صفر
    expect(out.punctuality).toBe(86.7);
    expect(out).toMatchObject({ quality: 100, closure: 100, excellence: 0, isSubjectToEvaluation: true });
    expect(out.finalScore).toBe(Math.round((86.6667 * 0.6 + 100 * 0.1 + 100 * 0.2 + 0) * 10) / 10);
    expect(out.lost).toHaveLength(1);
    expect(out.lost[0]).toMatchObject({ axis: 'punctuality', element: 'إعادة المواد', lateDays: 2 });
  });

  it('من لا عناصر مستحقة له ولا دورات حان إقفالها لا يُقيَّم', () => {
    const c = course({ startDate: '2027-03-01', endDate: '2027-03-05' });
    c.closureElements = [el(MATERIALS, { status: 'NOT_STARTED' })];
    const none = m.scoreEmployee({ elements: c.closureElements, courses: [c], ownedCourses: [c], now: NOW });
    expect(none).toMatchObject({ isSubjectToEvaluation: false, finalScore: null });
  });

  it('محور بلا بيانات يوزَّع وزنه على غيره', () => {
    const c = course({ closureElements: [] });
    const elements = [el(MATERIALS, { executionAt: '2026-12-10T10:00:00Z' })];
    const out = m.scoreEmployee({ elements, courses: [c], ownedCourses: [], now: NOW });
    // الالتزام ١٠٠ (٦٠) والجودة ١٠٠ (١٠) والتميّز ٠ (١٠) — الإقفال بلا بيانات
    expect(out.closure).toBeNull();
    expect(out.finalScore).toBe(87.5);
  });

  it('التميّز: النجمة ومراجعة الشهادات والتقارير حتى ١٠٠', () => {
    const c = course({ status: 'CLOSED', closedAt: '2026-12-12', documentation: { starAwarded: true }, closureElements: [el(MATERIALS)] });
    const out = m.scoreEmployee({ elements: [], courses: [c], ownedCourses: [c], activity: { certReviews: 2, fieldReports: 1, closureReviews: 1 }, now: NOW });
    expect(out.excellence).toBe(100);
    expect(out.excellenceParts).toMatchObject({ documentationStars: 1, certReviews: 2, closureReviewShare: 100 });
  });

  it('الإدخال المتأخر المرفوض مبرره يُخصم من الالتزام', () => {
    const c = course({ closureElements: [] });
    const elements = [el(MATERIALS, { executionAt: '2026-12-10T10:00:00Z' })];
    const out = m.scoreEmployee({ elements, courses: [c], ownedCourses: [], lateEntryPenalty: 7, now: NOW });
    expect(out.punctuality).toBe(93);
  });

  it('متوسط آخر ثلاثة أشهر يتجاهل غير الخاضعة للتقييم', () => {
    expect(m.rollingScore([90, null, 70, 80, 10])).toBe(80);
    expect(m.rollingScore([-1, 60])).toBe(60);
    expect(m.rollingScore([])).toBeNull();
  });
});
