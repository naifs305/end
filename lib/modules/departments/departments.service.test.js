import { describe, it, expect } from 'vitest';

const svc = require('./departments.service');

const now = new Date('2026-11-15T10:00:00Z');
const R = (noIssues, courseId = 'c') => ({ courseId, noIssues, createdAt: now });
const I = (department, issueType, impact = 'MEDIUM', delayDays = null, courseId = 'c1') => ({ department, issueType, impact, delayDays, courseId, createdAt: now });

describe('مؤشر أداء الإدارات', () => {
  it('إدارة بلا صعوبات مؤشرها ١٠٠، وتنزل بتكرار الصعوبات وأثرها', () => {
    const out = svc.aggregate({
      reviews: [R(false, 'c1'), R(false, 'c2'), R(true, 'c3'), R(true, 'c4')],
      issues: [I('business_dev', 'names_late', 'HIGH', 5, 'c1'), I('business_dev', 'names_incomplete', 'LOW', null, 'c2'), I('finance', 'advance_late', 'MEDIUM', 3, 'c1')],
      blockers: [{ reason: 'TRAINEE_NAMES', courseId: 'c2' }],
      now,
    });
    const bd = out.departments.find((d) => d.key === 'business_dev');
    const fin = out.departments.find((d) => d.key === 'finance');
    const legal = out.departments.find((d) => d.key === 'legal');
    // (١٫٥ + ٠٫٥ + ٠٫٥ بلاغ) ÷ ٤ = ٠٫٦٢٥ ← ٣٨
    expect(bd).toMatchObject({ issues: 2, blockers: 1, courses: 2, high: 1, avgDelay: 5, index: 38 });
    expect(fin.index).toBe(75);
    expect(legal.index).toBe(100);
    expect(out.totals).toMatchObject({ reviewed: 4, withIssues: 2, issues: 3, blockers: 1, avgDelay: 4 });
    // الأضعف أولاً
    expect(out.departments[0].key).toBe('business_dev');
  });

  it('بلا تقييمات لا مؤشر — لا يُحكم على إدارة دون بيانات', () => {
    const out = svc.aggregate({ reviews: [], issues: [], blockers: [], now });
    expect(out.departments.every((d) => d.index === null)).toBe(true);
    expect(out.totals.avgIndex).toBeNull();
  });

  it('تنظيف التقييم: الإدارة والنوع من القائمة وحدها، والتأخير بين ٠ و٣٦٥ ويقبل الأرقام العربية', () => {
    const out = svc.cleanIssues([
      { department: 'business_dev', issueType: 'names_late', impact: 'HIGH', delayDays: '٧' },
      { department: 'hacker', issueType: 'x' },
      { department: 'finance', issueType: 'not-a-type' },
      { department: 'hr', issueType: 'tickets_late', impact: 'WEIRD', delayDays: 9999 },
    ]);
    expect(out).toEqual([
      { department: 'business_dev', issueType: 'names_late', impact: 'HIGH', delayDays: 7, note: null },
      { department: 'hr', issueType: 'tickets_late', impact: 'MEDIUM', delayDays: 365, note: null },
    ]);
  });
});
