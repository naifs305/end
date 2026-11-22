import { describe, it, expect } from 'vitest';

const { fail } = require('./respond');
const { AppError } = require('../../shared/AppError');

function res() {
  const r = { statusCode: 0, body: null };
  r.status = (s) => { r.statusCode = s; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

describe('استجابة الخطأ — السبب الحقيقي يصل للمستخدم', () => {
  it('رفض الصلاحية بخطأ عادي (403) يصل برسالته، لا «خطأ في الخادم»', () => {
    const e = new Error('لا يمكنك اعتماد أو رفض عنصر قمت بتنفيذه (يلزم فصل المهام)');
    e.statusCode = 403;
    const r = fail(res(), e);
    expect(r.statusCode).toBe(403);
    expect(r.body.code).toBeUndefined();
    expect(r.body.message).toContain('فصل المهام');
  });

  it('رمز ترجمة مخصص يُحفظ ليُترجم في الواجهة', () => {
    const e = new Error('رسالة');
    e.statusCode = 400;
    e.code = 'serverErrors.certReview.notConfirmed';
    expect(fail(res(), e).body.code).toBe('serverErrors.certReview.notConfirmed');
  });

  it('خطأ تطبيق 4xx موسوم «خطأ خادم» قديماً يصل برسالته', () => {
    const r = fail(res(), AppError.badRequest('المستخدم مشرف بالفعل على مشروع آخر', 'serverErrors.common.serverError'));
    expect(r.statusCode).toBe(400);
    expect(r.body.code).toBeUndefined();
    expect(r.body.message).toBe('المستخدم مشرف بالفعل على مشروع آخر');
  });

  it('الخطأ غير المتوقع يبقى 500 «خطأ في الخادم»', () => {
    const r = fail(res(), new Error('boom'));
    expect(r.statusCode).toBe(500);
    expect(r.body.code).toBe('serverErrors.common.serverError');
  });
});

describe('رسائل التحقق بالعربية', () => {
  const { zodMessage } = require('./respond');
  it('الحقل الناقص يُذكر باسمه العربي بدل «Required»', () => {
    expect(zodMessage({ code: 'invalid_type', received: 'undefined', path: ['awaitedParty'], message: 'Required' })).toBe('الجهة المنتظَرة مطلوب');
    expect(zodMessage({ code: 'invalid_type', received: 'undefined', path: ['firstName'], message: 'Required' })).toBe('الاسم الأول مطلوب');
  });
  it('الرسالة العربية المكتوبة في المخطط تبقى كما هي', () => {
    expect(zodMessage({ code: 'too_small', path: ['name'], message: 'اسم الدورة مطلوب' })).toBe('اسم الدورة مطلوب');
  });
  it('حقل غير معروف يُذكر بمفتاحه', () => {
    expect(zodMessage({ code: 'invalid_enum_value', path: ['foo'], message: 'Invalid enum' })).toBe('قيمة «foo» غير صحيحة');
  });
});
