import { describe, it, expect } from 'vitest';

const svc = require('./interpreter.service');
const docs = require('../../reports/interpreterDocs');

const VALID = {
  fullName: 'أحمد بن محمد بن سالم الغامدي',
  nationalId: '1012345678',
  email: 'Ahmed@Example.COM',
  mobile: '0501234567',
  address: 'الرياض — حي النخيل',
};

describe('تطبيع الأرقام', () => {
  it('يحوّل الأرقام العربية إلى إنجليزية', () => {
    expect(svc.normalizeDigits('١٠١٢٣٤٥٦٧٨')).toBe('1012345678');
  });

  it('يحوّل الأرقام الفارسية أيضاً', () => {
    expect(svc.normalizeDigits('۰۵۰۱۲۳۴۵۶۷')).toBe('0501234567');
  });

  it('يترك الأرقام الإنجليزية كما هي', () => {
    expect(svc.normalizeDigits('0501234567')).toBe('0501234567');
  });
});

describe('التحقق من بيانات المترجم', () => {
  it('البيانات السليمة تُقبل ويُطبَّع البريد', () => {
    const out = svc.validate(VALID);
    expect(out.fullName).toBe(VALID.fullName);
    expect(out.nationalId).toBe('1012345678');
    expect(out.email).toBe('ahmed@example.com');
    expect(out.amount).toBe(null);
  });

  it('الهوية المكتوبة بأرقام عربية تُقبل', () => {
    const out = svc.validate({ ...VALID, nationalId: '١٠١٢٣٤٥٦٧٨' });
    expect(out.nationalId).toBe('1012345678');
  });

  it('الهوية بفواصل أو مسافات تُنظَّف', () => {
    const out = svc.validate({ ...VALID, nationalId: '1012-345 678' });
    expect(out.nationalId).toBe('1012345678');
  });

  it('هوية بتسعة أرقام تُرفض — المستند رسمي', () => {
    expect(() => svc.validate({ ...VALID, nationalId: '101234567' })).toThrow(/عشرة أرقام/);
  });

  it('هوية بأحد عشر رقماً تُرفض', () => {
    expect(() => svc.validate({ ...VALID, nationalId: '10123456789' })).toThrow(/عشرة أرقام/);
  });

  it('الاسم المفرد يُرفض — المستند رسمي', () => {
    expect(() => svc.validate({ ...VALID, fullName: 'أحمد' })).toThrow(/اسم المترجم/);
  });

  it('الاسم من مقطعين يُرفض', () => {
    expect(() => svc.validate({ ...VALID, fullName: 'أحمد الغامدي' })).toThrow(/اسم المترجم/);
  });

  it('الاسم من ثلاثة مقاطع فأكثر يُقبل', () => {
    expect(svc.validate({ ...VALID, fullName: 'أحمد محمد الغامدي' }).fullName).toBe('أحمد محمد الغامدي');
  });

  it('البريد غير الصحيح يُرفض', () => {
    expect(() => svc.validate({ ...VALID, email: 'ahmed@@example' })).toThrow(/البريد/);
  });

  it('الجوال القصير يُرفض', () => {
    expect(() => svc.validate({ ...VALID, mobile: '0501' })).toThrow(/الجوال/);
  });

  it('العنوان الفارغ يُرفض', () => {
    expect(() => svc.validate({ ...VALID, address: '  ' })).toThrow(/عنوان/);
  });

  it('المبلغ الفارغ يعني «غير محدد» لا صفراً', () => {
    expect(svc.validate({ ...VALID, amount: '' }).amount).toBe(null);
  });

  it('المبلغ بأرقام عربية يُقرأ', () => {
    expect(svc.validate({ ...VALID, amount: '١٥٠٠' }).amount).toBe(1500);
  });

  it('المبلغ السالب يُرفض', () => {
    expect(() => svc.validate({ ...VALID, amount: '-5' })).toThrow(/قيمة المستحق/);
  });

  it('المبلغ غير الرقمي يُرفض', () => {
    expect(() => svc.validate({ ...VALID, amount: 'ألف ريال' })).toThrow(/قيمة المستحق/);
  });

  it('رمز الخطأ يصاحب كل رفض — لتترجمه الواجهة', () => {
    try {
      svc.validate({ ...VALID, nationalId: '1' });
      throw new Error('كان يجب أن يُرفض');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('serverErrors.interpreter.nationalIdInvalid');
    }
  });
});

// ======================================================================
// المستندات: تُبنى من بيانات واحدة، فلا يختلف اسم بين مستند وآخر
// ======================================================================

const COURSE = {
  id: 'c1',
  name: 'أمن المعلومات المتقدم',
  code: 'od-2026-0042',
  city: 'الرياض',
  locationType: 'INTERNAL',
  beneficiaryEntity: 'وزارة الداخلية',
  startDate: new Date('2026-12-06T00:00:00.000Z'),
  endDate: new Date('2026-12-10T00:00:00.000Z'),
  primaryEmployee: { firstName: 'نايف', lastName: 'الشهراني' },
};

const INTERPRETER = { ...svc.validate(VALID), amount: 1500 };

describe('مستندات المترجم', () => {
  it('العقد يحمل الطرفين وبيانات البرنامج', () => {
    const html = docs.renderInterpreterContract({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain('جامعة نايف العربية للعلوم الأمنية');
    expect(html).toContain(INTERPRETER.fullName);
    expect(html).toContain(INTERPRETER.nationalId);
    expect(html).toContain(COURSE.name);
    expect(html).toContain(COURSE.code);
  });

  it('المستندات المطبوعة تُحمّل خط بوترس الجزيرة', () => {
    const html = docs.renderInterpreterContract({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain('/fonts/BoutrosJazirahTextLight.ttf');
    expect(html).toContain('Boutros Jazirah Text');
  });

  it('النص المحفوظ يعود في المستند بدل النص الإرشادي', () => {
    const html = docs.renderInterpreterContract({
      course: COURSE,
      interpreter: INTERPRETER,
      sections: { terms: 'البند الأول: يلتزم الطرف الثاني بالترجمة الفورية.' },
    });
    expect(html).toContain('البند الأول');
  });

  it('شريط الأدوات لا يظهر في الطباعة', () => {
    const html = docs.renderInterpreterContract({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain('.toolbar { display: none !important; }');
  });

  it('زر الحفظ لا يظهر لمن لا يملك التنفيذ', () => {
    const html = docs.renderInterpreterContract(
      { course: COURSE, interpreter: INTERPRETER },
      { trackingId: 't1', canEdit: false },
    );
    expect(html).not.toContain('id="saveBtn"');
  });

  it('نموذج الاستحقاق يُظهر قيمة المستحق', () => {
    const html = docs.renderInterpreterEntitlement({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain('قيمة المستحق');
  });

  it('الشهادة تحمل اسم المترجم واسم البرنامج وتاريخه', () => {
    const html = docs.renderInterpreterCertificate({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain(INTERPRETER.fullName);
    expect(html).toContain(COURSE.name);
    expect(html).toContain('أعمال الترجمة');
  });

  it('رسالة طلب الصرف تذكر الإتمام والمبلغ وبيانات المترجم', () => {
    const html = docs.renderInterpreterTransferEmail({ course: COURSE, interpreter: INTERPRETER });
    expect(html).toContain('أتمّ أعمال الترجمة');
    expect(html).toContain('صرف مستحقاته');
    expect(html).toContain(INTERPRETER.nationalId);
    expect(html).toContain('نايف الشهراني');
  });

  it('رسالة طلب الصرف بلا مبلغ لا تذكر مبلغاً', () => {
    const html = docs.renderInterpreterTransferEmail({
      course: COURSE,
      interpreter: { ...INTERPRETER, amount: null },
    });
    expect(html).toContain('صرف مستحقاته');
    expect(html).not.toContain('ريال</strong>');
  });

  it('الرسالة البريدية لا تعتمد على خط خارجي', () => {
    const html = docs.renderInterpreterTransferEmail({ course: COURSE, interpreter: INTERPRETER });
    expect(html).not.toContain('BoutrosJazirahTextLight.ttf');
  });
});
