import { describe, it, expect } from 'vitest';

const svc = require('./travelGuide.service');

const course = { name: 'دورة <أمن المطارات>', city: 'مدريد', startDate: '2026-12-14', endDate: '2026-12-18', primaryEmployee: { firstName: 'منسق', lastName: 'تجريبي' } };

describe('دليل السفر التعريفي', () => {
  it('الرابط يُقبل http(s) فقط', () => {
    expect(svc.cleanUrl('https://nauss-journey-planner.lovable.app/madrid')).toBe('https://nauss-journey-planner.lovable.app/madrid');
    expect(svc.cleanUrl('javascript:alert(1)')).toBe('');
    expect(svc.cleanUrl('ليس رابطاً')).toBe('');
    expect(svc.cleanUrl('')).toBe('');
  });

  it('تنظيف البيانات يحفظ وقت الطلب السابق ولا يقبل إجراءً غير معروف', () => {
    const g = svc.cleanGuide({ mode: 'hack', url: 'https://x.org', note: '  ملاحظة ' }, { requestedAt: '2026-11-10T00:00:00.000Z' });
    expect(g).toEqual({ mode: 'existing', url: 'https://x.org/', city: '', note: 'ملاحظة', requestedAt: '2026-11-10T00:00:00.000Z' });
  });

  it('رسالة الطلب باسم المدينة، وفيها رابط منصة الأدلة والتذكير بالمرفق، وتُهرّب النصوص', () => {
    const html = svc.renderRequestEmail(course, { city: 'مدريد', note: '<script>x</script>' });
    expect(html).toContain('دليل سفر تعريفي باسم «مدريد»');
    expect(html).toContain('ملف يتضمن المعلومات المراد إدراجها');
    expect(html).toContain(svc.PLANNER_URL);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;أمن المطارات&gt;');
  });

  it('عناوين الطلب الافتراضية لمدير الإدارة', () => {
    expect(svc.MAIL_DEFAULTS['travelGuide.request.email.to']).toBe('OD@nauss.edu.sa');
  });
});
