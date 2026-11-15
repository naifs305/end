import { describe, it, expect } from 'vitest';

const svc = require('./externalTrainer.service');

const course = { name: 'دورة <تجريبية>', city: 'الرياض', startDate: '2026-12-14', endDate: '2026-12-18', primaryEmployee: { firstName: 'منسق', lastName: 'تجريبي' } };

describe('المدرب الخارجي', () => {
  it('الإقامة قبل البرنامج بيوم وبعده بيوم ما لم تُدخل التذاكر، ثم تتبع التذاكر', () => {
    expect(svc.stayDates(course, svc.cleanTrainer({ nameAr: 'مدرب' }))).toEqual({ from: '2026-12-13', to: '2026-12-19', nights: 6 });
    const t = svc.cleanTrainer({ nameAr: 'مدرب', arrival: { date: '2026-12-12' }, departure: { date: '2026-12-20' } });
    expect(svc.stayDates(course, t)).toMatchObject({ from: '2026-12-12', to: '2026-12-20', nights: 8 });
  });

  it('تنظيف البيانات: تواريخ وأوقات صحيحة فقط، ودرجة سفر من القائمة', () => {
    const t = svc.cleanTrainer({ nameAr: 'مدرب', ticketClass: 'فاخرة', travelOut: 'غداً', arrival: { date: '2026-12-12', time: '9pm' } });
    expect(t.ticketClass).toBe('ضيافة');
    expect(t.travelOut).toBe('');
    expect(t.arrival).toMatchObject({ date: '2026-12-12', time: '' });
  });

  it('الرسائل تُهرّب الأسماء ولا تُدرجها HTML خاماً، وفيها التذكير بالمرفقات', () => {
    const t = svc.cleanTrainer({ nameAr: '<b>مدرب</b>', nameEn: 'JOHN', passportNo: 'P1', departureCity: 'لندن', arrival: { date: '2026-12-12' }, departure: { date: '2026-12-20' } });
    const hr = svc.renderHrEmail(course, t);
    expect(hr).not.toContain('<b>مدرب</b>');
    expect(hr).toContain('&lt;b&gt;');
    expect(hr).toContain('موافقة معالي الرئيس');
    expect(svc.renderHospitalityEmail(course, t)).toContain('تذكرة المدرب');
  });
});
