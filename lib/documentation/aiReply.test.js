import { describe, it, expect } from 'vitest';
import { parseNumberedReply, cleanSingleReply } from './aiReply';

const ai = require('../modules/documentation/documentation.ai');

describe('رد أداة الذكاء الاصطناعي — توزيعه على الجلسات', () => {
  it('يقرأ الصيغ الشائعة للترقيم ويوزّعها برقم الجلسة', () => {
    const reply = [
      '1: تناولت الجلسة الافتتاحية أهداف البرنامج ومحاوره.',
      '',
      '**2.** استعرض الخبير مفاهيم الاستشراف ومدارسه',
      'مع أمثلة من المؤسسات الأمنية.',
      'الجلسة ٣ — تدرّب المشاركون على بناء السيناريوهات.',
      '4) رصد المشاركون الإشارات الضعيفة والاتجاهات الناشئة.',
    ].join('\n');
    const out = parseNumberedReply(reply, 5);
    expect(Object.keys(out).map(Number)).toEqual([0, 1, 2, 3]);
    expect(out[1]).toBe('استعرض الخبير مفاهيم الاستشراف ومدارسه مع أمثلة من المؤسسات الأمنية.');
    expect(out[2]).toContain('بناء السيناريوهات');
  });

  it('يتجاهل الأرقام خارج عدد الجلسات وما قبل أول رقم', () => {
    const out = parseNumberedReply('إليك الأوصاف:\n9: جلسة غير موجودة إطلاقاً هنا\n1: وصف الجلسة الأولى كاملاً', 2);
    expect(out).toEqual({ 0: 'وصف الجلسة الأولى كاملاً' });
  });

  it('ينظّف رد النص الواحد من التقديم والتنسيق', () => {
    expect(cleanSingleReply('إليك المقدمة:\n**انعقد البرنامج في جنيف.**')).toBe('انعقد البرنامج في جنيف.');
  });
});

describe('الطلب الجاهز — بلا مفتاح على الخادم', () => {
  const course = { name: 'دورة تجريبية', city: 'جنيف', startDate: '2026-08-24', endDate: '2026-08-28', numTrainees: 14 };
  const sessions = [{ title: 'الافتتاح' }, { title: 'مفاهيم الاستشراف', presenter: 'خبير' }, { title: 'الختام', description: 'وصف قائم' }];

  it('طلب الأوصاف يرقّم من ١ ويحدد صيغة الرد ولا يتصل بالخدمة', async () => {
    const r = await ai.describeSessions({ course, intro: '', sessions, indexes: [0, 1], promptOnly: true });
    expect(r.wanted).toEqual([0, 1]);
    expect(r.prompt).toContain('1. الافتتاح');
    expect(r.prompt).toContain('اكتب أوصاف الجلسات ذات الأرقام: 1، 2');
    expect(r.prompt).toContain('1: نص الفقرة');
    expect(r.prompt).toContain('وصفها الحالي: وصف قائم');
  });

  it('طلب المقدمة يحمل قواعد الأسلوب ومعلومات البرنامج', async () => {
    const r = await ai.composeText({ field: 'intro', course, texts: {}, sessions, trainees: { count: 0, entities: [], distinctions: [] }, promptOnly: true });
    expect(r.prompt).toContain('مقدمة المجلة');
    expect(r.prompt).toContain('مكان الانعقاد: جنيف');
    expect(r.prompt).toContain('لا تخترع');
  });
});
