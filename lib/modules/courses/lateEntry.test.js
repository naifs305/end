import { describe, it, expect, vi, beforeEach } from 'vitest';

const le = require('./lateEntry');
const config = require('../config/config.service');

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(config, 'getSetting').mockResolvedValue('72');
});

describe('قياس تأخّر الإدخال', () => {
  const start = new Date('2026-11-10T08:00:00.000Z');

  it('الإدخال قبل المهلة ليس متأخراً', () => {
    // المتوقّع: قبل البداية بـ٧٢ ساعة = 11-07. والإدخال 11-05 مبكّر
    const r = le.measureLateness(start, new Date('2026-11-05T08:00:00.000Z'), 72);
    expect(r.isLate).toBe(false);
    expect(r.hoursLate).toBe(0);
  });

  it('الإدخال في آخر لحظة من المهلة ليس متأخراً', () => {
    const r = le.measureLateness(start, new Date('2026-11-07T08:00:00.000Z'), 72);
    expect(r.isLate).toBe(false);
  });

  it('الإدخال بعد المهلة متأخر بالفارق', () => {
    const r = le.measureLateness(start, new Date('2026-11-09T08:00:00.000Z'), 72);
    expect(r.isLate).toBe(true);
    expect(r.hoursLate).toBe(48);
  });

  it('الإدخال بعد انتهاء الدورة متأخر كثيراً', () => {
    const r = le.measureLateness(start, new Date('2026-12-01T08:00:00.000Z'), 72);
    expect(r.isLate).toBe(true);
    expect(r.hoursLate).toBe(576); // ٢٤ يوماً
  });

  it('تاريخ غير صحيح لا يُعدّ تأخيراً', () => {
    const r = le.measureLateness('غير-تاريخ', new Date(), 72);
    expect(r.isLate).toBe(false);
  });
});

describe('اشتقاق حالة الدورة من تواريخها', () => {
  const now = new Date('2026-11-12T08:00:00.000Z');

  it('دورة قادمة = تحت الإعداد', () => {
    expect(le.deriveStatusFromDates(
      new Date('2026-12-01'), new Date('2026-12-05'), now,
    )).toBe('PREPARATION');
  });

  it('دورة جارية = تنفيذ', () => {
    expect(le.deriveStatusFromDates(
      new Date('2026-11-10'), new Date('2026-11-15'), now,
    )).toBe('EXECUTION');
  });

  it('دورة منتهية = بانتظار الإقفال — لا تحت الإعداد', () => {
    expect(le.deriveStatusFromDates(
      new Date('2026-10-01'), new Date('2026-10-05'), now,
    )).toBe('AWAITING_CLOSURE');
  });
});

describe('النقطة المتدرّجة', () => {
  it('تتدرّج بحسب مقدار التأخير', () => {
    expect(le.penaltyPointsFor(12)).toBe(2);    // نصف يوم
    expect(le.penaltyPointsFor(48)).toBe(4);    // يومان
    expect(le.penaltyPointsFor(144)).toBe(7);   // ٦ أيام
    expect(le.penaltyPointsFor(720)).toBe(10);  // ٣٠ يوماً
  });

  it('دورة تأخرت يوماً ليست كدورة أُدخلت بعد انتهائها بشهر', () => {
    expect(le.penaltyPointsFor(24)).toBeLessThan(le.penaltyPointsFor(720));
  });
});

describe('بناء حقول الإدخال', () => {
  it('الإدخال في موعده: لا تأخير ولا مبرر', async () => {
    const res = await le.buildLateEntryFields({
      startDate: new Date('2026-12-01T08:00:00.000Z'),
      endDate: new Date('2026-12-05T08:00:00.000Z'),
    }, new Date('2026-11-12T08:00:00.000Z'));

    expect(res.isLate).toBe(false);
    expect(res.fields.isLateEntry).toBe(false);
    expect(res.fields.status).toBe('PREPARATION');
    expect(res.fields.lateEntryStatus).toBeUndefined();
  });

  it('الإدخال المتأخر يُسجَّل بانتظار قرار المدير', async () => {
    const res = await le.buildLateEntryFields({
      startDate: new Date('2026-10-01T08:00:00.000Z'),
      endDate: new Date('2026-10-05T08:00:00.000Z'),
      lateEntryReason: 'نسيت إدخالها بسبب ضغط العمل في نهاية الربع',
    }, new Date('2026-11-12T08:00:00.000Z'));

    expect(res.isLate).toBe(true);
    expect(res.fields.isLateEntry).toBe(true);
    expect(res.fields.lateEntryStatus).toBe('PENDING');
    expect(res.fields.status).toBe('AWAITING_CLOSURE');
    expect(res.fields.entryBaselineAt).toEqual(new Date('2026-11-12T08:00:00.000Z'));
    expect(res.fields.lateEntryReason).toContain('ضغط العمل');
  });

  it('المبرر الفارغ يُعاد فارغاً ليرفضه المنادي', async () => {
    const res = await le.buildLateEntryFields({
      startDate: new Date('2026-10-01T08:00:00.000Z'),
      endDate: new Date('2026-10-05T08:00:00.000Z'),
    }, new Date('2026-11-12T08:00:00.000Z'));

    expect(res.isLate).toBe(true);
    expect(res.reason).toBe('');
  });

  it('يقرأ المهلة من إعدادات المنصة', async () => {
    config.getSetting.mockResolvedValue('240'); // ١٠ أيام
    const res = await le.buildLateEntryFields({
      startDate: new Date('2026-11-16T08:00:00.000Z'),
      endDate: new Date('2026-11-20T08:00:00.000Z'),
    }, new Date('2026-11-12T08:00:00.000Z'));

    // المتوقّع: قبل البداية بـ٢٤٠ ساعة = 11-06، والإدخال 11-12 متأخر
    expect(res.isLate).toBe(true);
  });
});

describe('وصف التأخير بالعربية', () => {
  it('يصوغ المدة صياغة سليمة', () => {
    expect(le.describeLateness(12)).toBe('أقل من يوم');
    expect(le.describeLateness(24)).toBe('يوم واحد');
    expect(le.describeLateness(48)).toBe('يومان');
    expect(le.describeLateness(120)).toBe('5 أيام');
    expect(le.describeLateness(720)).toBe('30 يوماً');
  });
});
