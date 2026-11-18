import { describe, it, expect } from 'vitest';
const { toInsight } = require('./fieldReports.insights');

const row = (over = {}) => ({
  trackingId: 't1', report: 'closing_report', at: new Date('2026-11-06'),
  courseId: 'c1', courseName: 'إدارة الحشود', city: 'سيول',
  authorId: 'u1', firstName: 'ثامر', lastName: 'العاصمي',
  section: 'lms_evaluation', rating: 'requires_development', text: 'بطء شديد جداً يؤثر على سرعة إنجاز العمل',
  ...over,
});

describe('ملاحظات ميدانية من تقارير الدورات', () => {
  it('التقدير الضعيف ملاحظة «تحتاج معالجة» بمصدرها وكاتبها ودورتها', () => {
    const i = toInsight(row());
    expect(i).toMatchObject({ kind: 'issue', sectionLabel: 'منصة التدريب', source: 'تقرير الاختتام', author: { name: 'ثامر العاصمي' }, course: { name: 'إدارة الحشود' } });
  });

  it('الممتاز إشادة، والتوصيات توصية، وجاهزية الافتتاح ملاحظة', () => {
    expect(toInsight(row({ rating: 'excellent' })).kind).toBe('praise');
    expect(toInsight(row({ section: 'recommendations', rating: null })).kind).toBe('recommendation');
    expect(toInsight(row({ section: 'readiness_notes', rating: null, report: 'opening_report' }))).toMatchObject({ kind: 'note', source: 'تقرير الافتتاح' });
  });

  it('يتجاهل القصير جداً والروابط والصور', () => {
    expect(toInsight(row({ text: 'جيد' }))).toBeNull();
    expect(toInsight(row({ text: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAA' }))).toBeNull();
  });
});
