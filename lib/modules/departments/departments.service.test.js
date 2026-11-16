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
    const empty = { note: null, resolution: null, country: null, city: null, venue: null };
    expect(out).toEqual([
      { department: 'business_dev', issueType: 'names_late', impact: 'HIGH', delayDays: 7, ...empty },
      { department: 'hr', issueType: 'tickets_late', impact: 'MEDIUM', delayDays: 365, ...empty },
    ]);
  });

  it('صعوبة جديدة يكتبها المنسق تُقبل بنصها، والقصيرة جداً تُهمل', () => {
    const out = svc.cleanIssues([
      { department: 'agency_office', issueType: 'new', newLabel: '  تأخر موافقة المعالي   من مكتب الوكيل ' },
      { department: 'agency_office', issueType: 'new', newLabel: 'لا' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ issueType: 'new', newLabel: 'تأخر موافقة المعالي من مكتب الوكيل' });
  });

  it('الصعوبات التي أضافها الزملاء مقبولة باختيارها، وغير المعروفة مرفوضة', () => {
    const out = svc.cleanIssues([
      { department: 'finance', issueType: 'c_ab12' },
      { department: 'finance', issueType: 'c_unknown' },
    ], new Set(['c_ab12']));
    expect(out.map((i) => i.issueType)).toEqual(['c_ab12']);
  });

  it('موقع التنفيذ يُحفظ لصعوبات المقر وحدها، ومعه طريقة التجاوز', () => {
    const [venue, hr] = svc.cleanIssues([
      { department: 'venue', issueType: 'internet_slow', country: 'إسبانيا', city: 'مدريد', venue: 'فندق المؤتمرات', resolution: 'خط إنترنت مستقل للقاعة' },
      { department: 'hr', issueType: 'tickets_late', country: 'إسبانيا', city: 'مدريد' },
    ]);
    expect(venue).toMatchObject({ country: 'إسبانيا', city: 'مدريد', venue: 'فندق المؤتمرات', resolution: 'خط إنترنت مستقل للقاعة' });
    expect(hr).toMatchObject({ country: null, city: null, venue: null });
  });

  it('قائمة الاختيار تضم ما أضافه الزملاء قبل «أخرى»', () => {
    const cat = svc.mergeCatalog([{ department: 'agency_office', key: 'c_1', label: 'تأخر موافقة المعالي من مكتب الوكيل', usageCount: 3 }]);
    const ag = cat.find((d) => d.key === 'agency_office');
    expect(ag.issues.slice(-2)).toEqual([
      { key: 'c_1', label: 'تأخر موافقة المعالي من مكتب الوكيل', custom: true, uses: 3 },
      { key: 'other', label: 'أخرى' },
    ]);
    expect(cat.find((d) => d.key === 'venue').location).toBe(true);
  });
});

describe('مساعد التنفيذ — ترتيب خبرة الزملاء', () => {
  const at = (d) => new Date(`2026-11-${d}T08:00:00Z`);
  const issues = [
    { department: 'venue', issueType: 'internet_slow', impact: 'HIGH', delayDays: null, country: 'إسبانيا', city: 'مدريد', venue: 'فندق أ', resolution: 'شريحة بيانات احتياطية', courseId: 'c1', createdAt: at(10) },
    { department: 'venue', issueType: 'internet_slow', impact: 'MEDIUM', delayDays: null, country: 'إسبانيا', city: 'مدريد', venue: 'فندق أ', note: 'انقطع يومين', courseId: 'c2', createdAt: at(12) },
    { department: 'venue', issueType: 'hall_issue', impact: 'LOW', delayDays: null, country: 'إسبانيا', city: 'مدريد', venue: 'فندق ب', courseId: 'c3', createdAt: at(5) },
    { department: 'agency_office', issueType: 'c_9', impact: 'HIGH', delayDays: 6, note: 'أسبوع انتظار', courseId: 'c1', createdAt: at(11) },
    { department: 'agency_office', issueType: 'c_9', impact: 'MEDIUM', delayDays: 2, courseId: 'c4', createdAt: at(14) },
  ];
  const labelOf = (dep, key) => (key === 'c_9' ? 'تأخر موافقة المعالي' : require('./catalog').issueLabel(dep, key));
  const out = svc.organize(issues, { labelOf, names: new Map([['c1', 'دورة مدريد']]) });

  it('الإدارات مرتبة بعدد الصعوبات، والأنواع بتكرارها، مع متوسط التأخير والأحدث', () => {
    expect(out.departments.map((d) => d.key)).toEqual(['venue', 'agency_office']);
    const venue = out.departments[0];
    expect(venue.types[0]).toMatchObject({ key: 'internet_slow', label: 'بطء الإنترنت أو انقطاعه', count: 2, high: 1 });
    const ag = out.departments[1].types[0];
    expect(ag).toMatchObject({ label: 'تأخر موافقة المعالي', count: 2, avgDelay: 4 });
    expect(new Date(ag.lastAt)).toEqual(at(14));
  });

  it('الحلول المجرّبة تظهر مع موضعها واسم الدورة', () => {
    const r = out.departments[0].types[0].resolutions;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ resolution: 'شريحة بيانات احتياطية', place: 'فندق أ، مدريد، إسبانيا', courseName: 'دورة مدريد' });
  });

  it('المقرات مجمّعة بالمدينة ثم المقر، ومعها صعوباتها ونصائحها', () => {
    expect(out.locations).toHaveLength(1);
    const madrid = out.locations[0];
    expect(madrid).toMatchObject({ country: 'إسبانيا', city: 'مدريد', count: 3 });
    expect(madrid.venues[0]).toMatchObject({ venue: 'فندق أ', count: 2, issues: [{ label: 'بطء الإنترنت أو انقطاعه', count: 2 }], tips: ['شريحة بيانات احتياطية'] });
    expect(madrid.venues[1].venue).toBe('فندق ب');
  });
});
