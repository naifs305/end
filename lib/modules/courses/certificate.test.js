import { describe, it, expect } from 'vitest';

const cert = require('./certificate');
const { computeElementDeadlines } = require('../../shared/deadlines');
const { certificateChangeIssues } = require('../departments/departments.service');

const NOW = new Date('2026-11-23T08:00:00Z');

describe('نوع الشهادة عند إنشاء الدورة', () => {
  it('الاجتياز يستلزم الاختبار البعدي ويُعدّ مؤكَّداً', () => {
    expect(cert.createFields('PASS', NOW)).toEqual({ certificateType: 'PASS', certificateTypeConfirmedAt: NOW, requiresPostTest: true });
  });
  it('الحضور بلا اختبارات', () => {
    expect(cert.createFields('ATTENDANCE', NOW)).toMatchObject({ requiresPreTest: false, requiresPostTest: false });
  });
  it('بانتظار التحديد: غير مؤكَّد ولا يمسّ الاختبارات', () => {
    expect(cert.createFields('PENDING', NOW)).toEqual({ certificateType: 'PENDING' });
  });
  it('نوع غير معروف يُرفض', () => {
    expect(() => cert.createFields('X')).toThrow();
  });
});

describe('تغيير نوع الشهادة', () => {
  it('تأكيد ما كان بانتظار التحديد ليس تغييراً', () => {
    const s = cert.transition('PENDING', 'PASS', NOW);
    expect(s.confirmedNow).toBe(true);
    expect(s.changedAfterConfirm).toBe(false);
    expect(s.fields.certificateTypeChangedAt).toBeUndefined();
    expect(s.fields.certificateTypeResolvedAt).toEqual(NOW);
  });
  it('من اجتياز إلى حضور بعد التأكيد: يُسجَّل تغييراً ويُعدّ', () => {
    const s = cert.transition('PASS', 'ATTENDANCE', NOW);
    expect(s.changedAfterConfirm).toBe(true);
    expect(s.fields).toMatchObject({ certificateTypeChangedAt: NOW, certificateTypeChangeCount: { increment: 1 }, requiresPostTest: false });
  });
  it('لا عودة إلى الانتظار بعد التأكيد', () => {
    expect(() => cert.transition('ATTENDANCE', 'PENDING', NOW)).toThrow();
  });
  it('النوع نفسه لا يغيّر شيئاً', () => {
    expect(cert.transition('PASS', 'PASS', NOW).changed).toBe(false);
  });
});

describe('لا يُحاسَب المنسق على اختبار استجدّ بتغيير النوع', () => {
  const postTest = { element: { key: 'post_test', deadlineRefPoint: 'END', deadlineIdealHours: 0, deadlineMaxHours: 24, isDeadlineWorkingDays: false } };
  const course = (changedAt) => ({ startDate: '2026-11-22T06:00:00Z', endDate: '2026-11-24T12:00:00Z', certificateTypeChangedAt: changedAt });

  it('تغيّر قبل موعده الأقصى بأقل من ٧٢ ساعة: يُستثنى توقيته', () => {
    const d = computeElementDeadlines(postTest, course('2026-11-23T10:00:00Z'), NOW);
    expect(d.excludedFromTiming).toBe(true);
    expect(d.exclusionReason).toBe('CERTIFICATE_TYPE_CHANGED');
  });
  it('تغيّر مبكراً بمهلة كافية: يُحتسب كالمعتاد', () => {
    const d = computeElementDeadlines(postTest, course('2026-11-01T10:00:00Z'), NOW);
    expect(d.excludedFromTiming).toBe(false);
  });
  it('وكذلك تأكيد المعلّق متأخراً (قرب إطلاق الشهادات)', () => {
    const late = { ...course(null), certificateTypeResolvedAt: '2026-11-24T20:00:00Z' };
    expect(computeElementDeadlines(postTest, late, NOW).exclusionReason).toBe('CERTIFICATE_TYPE_CHANGED');
  });
  it('ولا يمسّ العناصر الأخرى', () => {
    const other = { element: { ...postTest.element, key: 'certificates' } };
    expect(computeElementDeadlines(other, course('2026-11-23T10:00:00Z'), NOW).excludedFromTiming).toBe(false);
  });
});

describe('تغيير النوع يُسجَّل على إدارة تصميم البرامج التدريبية', () => {
  const rows = [
    { id: 'c1', startDate: '2026-11-25T06:00:00Z', certificateTypeChangedAt: '2026-11-23T06:00:00Z', certificateTypeChangeCount: 1 },
    { id: 'c2', startDate: '2026-12-20T06:00:00Z', certificateTypeChangedAt: '2026-11-23T06:00:00Z', certificateTypeChangeCount: 2 },
  ];
  it('أثره كبير قرب البداية، ومتوسط قبلها بمهلة', () => {
    const out = certificateChangeIssues(rows);
    expect(out.map((i) => [i.courseId, i.department, i.issueType, i.impact])).toEqual([
      ['c1', 'program_design', 'cert_type_changed', 'HIGH'],
      ['c2', 'program_design', 'cert_type_changed', 'MEDIUM'],
    ]);
  });
  it('ولا يُكرَّر ما سجّله المنسق بنفسه في تقييم الإقفال', () => {
    expect(certificateChangeIssues(rows, new Set(['c1'])).map((i) => i.courseId)).toEqual(['c2']);
  });
});
