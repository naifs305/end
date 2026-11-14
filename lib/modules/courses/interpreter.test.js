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

  it('رقم الحساب الدولي يُنظَّف ويُرفع', () => {
    const out = svc.validate({ ...VALID, iban: 'sa00 0000 0000 0000 0000 0002' });
    expect(out.iban).toBe('SA0000000000000000000002');
  });

  it('رقم حساب دولي مشوّه يُرفض — المستند مالي', () => {
    expect(() => svc.validate({ ...VALID, iban: '12' })).toThrow(/الحساب الدولي/);
  });

  it('غياب رقم الحساب لا يمنع حفظ بقية البيانات', () => {
    expect(svc.validate(VALID).iban).toBe(null);
  });

  it('الجنسية والبنك يُحفظان حين يُكتبان', () => {
    const out = svc.validate({ ...VALID, nationality: 'سعودي', bankName: 'مصرف الراجحي' });
    expect(out.nationality).toBe('سعودي');
    expect(out.bankName).toBe('مصرف الراجحي');
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
// المستندات: تُبنى من بيانات واحدة بالصيغ المعتمدة
// ======================================================================

const COURSE = {
  id: 'c1',
  name: 'تأمين القواعد والمعسكرات',
  code: 'od-2026-0042',
  city: 'جمهورية بولندا',
  locationType: 'EXTERNAL',
  beneficiaryEntity: 'وزارة الداخلية',
  startDate: new Date('2026-11-16T00:00:00.000Z'),
  endDate: new Date('2026-11-27T00:00:00.000Z'),
  primaryEmployee: { firstName: 'نايف', lastName: 'الشهراني' },
};

const INTERPRETER = {
  ...svc.validate({
    ...VALID,
    fullName: 'سالم بن أحمد العلي',
    nationalId: '1000000002',
    nationality: 'سعودي',
    bankName: 'مصرف الراجحي',
    iban: 'SA0000000000000000000002',
  }),
  amount: 12000,
};

describe('ما ينقص لإصدار مستند', () => {
  it('لا بيانات مترجم = لا مستند', () => {
    expect(svc.missingForDocument('interpreter_contract', null)).toEqual(['بيانات المترجم']);
  });

  it('المستند المالي يحتاج المبلغ والبنك والحساب', () => {
    const missing = svc.missingForDocument('interpreter_transfer', {
      ...INTERPRETER, amount: null, bankName: null, iban: null,
    });
    expect(missing).toHaveLength(3);
  });

  it('البيانات الكاملة لا ينقصها شيء', () => {
    expect(svc.missingForDocument('interpreter_contract', INTERPRETER)).toEqual([]);
  });

  it('الشهادة لا تحتاج بيانات مالية', () => {
    expect(svc.missingForDocument('interpreter_certificate', {
      ...INTERPRETER, amount: null, bankName: null, iban: null,
    })).toEqual([]);
  });
});

describe('عقد تقديم خدمات أعمال الترجمة الفورية', () => {
  const html = () => docs.renderInterpreterContract({ course: COURSE, interpreter: INTERPRETER });

  it('يحمل عنوان الصيغة المعتمدة', () => {
    expect(html()).toContain('عقد تقديم خدمات أعمال الترجمة الفورية');
  });

  it('يحمل الطرفين كما في الصيغة', () => {
    const out = html();
    expect(out).toContain('جامعة نايف العربية للعلوم الأمنية');
    expect(out).toContain('ويشار إليها فيما بعد');
    expect(out).toContain('سالم بن أحمد العلي');
    expect(out).toContain('1000000002');
    expect(out).toContain('(سعودي الجنسية)');
  });

  it('يحمل المواد الاثنتي عشرة', () => {
    const out = html();
    const titles = [
      'المادة الأولى: إلزامية التمهيد',
      'المادة الثانية: وثائق العقد',
      'المادة الثالثة: موضوع العقد',
      'المادة الرابعة: مدة العقد',
      'المادة الخامسة: قيمة العقد وطريقة الدفع',
      'المادة السادسة: التزامات الطرف الأول',
      'المادة السابعة: التزامات الطرف الثاني',
      'المادة الثامنة: انقضاء العقد',
      'المادة التاسعة: الالتزام بالسرية',
      'المادة العاشرة: تسوية النزاعات والنظام واجب التطبيق',
      'المادة الحادية عشرة: المراسلات والإشعارات',
      'المادة الثانية عشرة: نسخ العقد',
    ];
    for (const title of titles) expect(out).toContain(title);
  });

  it('المبلغ يُفقَّط كتابةً من الرقم فلا يختلفان', () => {
    const out = html();
    expect(out).toContain('12,000');
    expect(out).toContain('اثنا عشر ألفاً ريال سعودي لا غير');
    expect(out).toContain('6,000');
    expect(out).toContain('ستة آلاف ريال سعودي لا غير');
  });

  it('مدة العقد تمتد يومين قبل الدورة ويومين بعدها', () => {
    const out = html();
    expect(out).toContain('2026/11/14');
    expect(out).toContain('2026/11/29');
    expect(out).toContain('(16) يوما');
  });

  it('جدول الدورة من بيانات الدورة', () => {
    const out = html();
    expect(out).toContain('تأمين القواعد والمعسكرات');
    expect(out).toContain('2026/11/16');
    expect(out).toContain('2026/11/27');
  });

  it('جدول الحساب البنكي يظهر', () => {
    const out = html();
    expect(out).toContain('مصرف الراجحي');
    expect(out).toContain('SA0000000000000000000002');
  });

  it('رقم العقد يُشتق من رقم الدورة', () => {
    expect(html()).toContain('0042/NAUSS/26');
  });

  it('ممثل الجامعة يأتي من الإعدادات لا من الكود', () => {
    const out = docs.renderInterpreterContract({
      course: COURSE,
      interpreter: INTERPRETER,
      config: { rep: 'فلان الفلاني', repTitle: 'وكيل الجامعة للتدريب', email: 'x@nauss.edu.sa' },
    });
    expect(out).toContain('فلان الفلاني');
    expect(out).toContain('x@nauss.edu.sa');
  });

  it('النص المحفوظ يحل محل الصيغة الافتراضية', () => {
    const out = docs.renderInterpreterContract({
      course: COURSE,
      interpreter: INTERPRETER,
      sections: { art4: 'مدة هذا العقد عشرون يوماً.' },
    });
    expect(out).toContain('مدة هذا العقد عشرون يوماً.');
  });

  it('النص المحفوظ يُهرَّب فلا يُنفَّذ في الصفحة', () => {
    const out = docs.renderInterpreterContract({
      course: COURSE,
      interpreter: INTERPRETER,
      sections: { art4: '<img src=x onerror=alert(1)>' },
    });
    expect(out).not.toContain('<img src=x');
    expect(out).toContain('&lt;img');
  });

  it('يُحمّل خط بوترس الجزيرة', () => {
    const out = html();
    expect(out).toContain('/fonts/BoutrosJazirahTextLight.ttf');
    expect(out).toContain('Boutros Jazirah Text');
  });

  it('شريط الأدوات لا يظهر في الطباعة', () => {
    expect(html()).toContain('.toolbar { display: none !important; }');
  });

  it('يُطبع على مطبوعات الجامعة: ترويسة أعلى كل ورقة وتذييل أسفلها', () => {
    const out = html();
    expect(out).toContain('/letterhead-header.jpg');
    expect(out).toContain('/letterhead-footer.jpg');
    expect(out).toContain('<div class="letterhead letterhead-top"></div>');
    expect(out).toContain('<div class="letterhead letterhead-bottom"></div>');
    // ثبات الموضع هو ما يكرّر المطبوعة على كل صفحة عند الطباعة
    expect(out).toContain('position: fixed');
  });

  it('المطبوعة تغطي الورقة، والنص لا ينزل تحت الترويسة ولا فوق التذييل في أي صفحة', () => {
    const out = html();
    expect(out).toContain('@page { size: A4; margin: 0; }');
    // رأس الإطار وذيله يتكرران مع كل ورقة فيحجزان مكان المطبوعة
    expect(out).toContain('<thead><tr><td><div class="frame-top"></div></td></tr></thead>');
    expect(out).toContain('<tfoot><tr><td><div class="frame-bottom"></div></td></tr></tfoot>');
  });

  it('خيار «الورق مطبوع مسبقاً» متاح فيُخفي الخلفية', () => {
    const out = html();
    expect(out).toContain('id="noLetterhead"');
    expect(out).toContain('body.no-letterhead .letterhead { display: none; }');
  });

  it('زر الحفظ لا يظهر لمن لا يملك التنفيذ', () => {
    const out = docs.renderInterpreterContract(
      { course: COURSE, interpreter: INTERPRETER },
      { trackingId: 't1', canEdit: false },
    );
    expect(out).not.toContain('id="saveBtn"');
  });
});

describe('التاريخ الهجري', () => {
  it('يُحسب بتقويم أم القرى', () => {
    expect(docs.hijri(new Date('2026-11-14T12:00:00.000Z'))).toBe('1448/06/04');
  });

  it('التاريخ غير الصحيح يرجع فارغاً', () => {
    expect(docs.hijri('غير-تاريخ')).toBe('');
  });
});

describe('نموذج الاستحقاق المالي (TF05)', () => {
  const html = () => docs.renderInterpreterEntitlement({ course: COURSE, interpreter: INTERPRETER });

  it('يحمل عنوان النموذج ورمزه', () => {
    expect(html()).toContain('نموذج استحقـاق مالـي (TF05)');
  });

  it('مضغوط ليبقى ورقة واحدة كالأصل', () => {
    expect(html()).toContain('class="compact red-title"');
  });

  it('اسم الإدارة وبيانات النشاط من الدورة', () => {
    const out = html();
    expect(out).toContain('وكالة التدريب');
    expect(out).toContain('تأمين القواعد والمعسكرات');
    expect(out).toContain('جمهورية بولندا');
  });

  it('يؤشّر «دورة تدريبية» في نوع النشاط تلقائياً', () => {
    expect(html()).toContain('<span class="box">✓</span>دورة تدريبية');
  });

  it('يؤشّر «ترجمة فورية» في دور صاحب الاستحقاق', () => {
    const out = html();
    const row = out.match(/<tr>\s*<td class="box-cell"><span class="box">✓<\/span><\/td>\s*<td class="role">ترجمة فورية\./);
    expect(row).toBeTruthy();
  });

  it('لا يؤشّر دوراً آخر', () => {
    const out = html();
    const row = out.match(/<tr>\s*<td class="box-cell"><span class="box"><\/span><\/td>\s*<td class="role">محاضر\./);
    expect(row).toBeTruthy();
  });

  it('يحمل خانات النموذج الأصلي كلها', () => {
    const out = html();
    for (const label of [
      'اسم الإدارة:', 'عنوان النشاط:', 'مكان الانعقاد:', 'التاريخ:',
      'نوع النشاط:', 'دور صاحب الاستحقاق فيه:', 'عدد الساعات:',
      'اسم صاحب الاستحقاق:', 'مقدار المبلغ المستحق:', 'رقماً:', 'كتابة:',
      'البنك:', 'الفرع:', 'الدولة:', 'رقم الايبان',
      'إذا كان الحساب خارج دولة المقر: Soft Code',
    ]) {
      expect(out).toContain(label);
    }
  });

  it('يحمل أنواع النشاط الستة وأدوار الاستحقاق الستة', () => {
    const out = html();
    for (const item of docs.ACTIVITY_TYPES) expect(out).toContain(item);
    for (const role of docs.BENEFICIARY_ROLES) expect(out).toContain(role);
  });

  it('عنوانه أحمر كالنموذج الأصلي', () => {
    const out = html();
    expect(out).toContain('red-title');
    expect(out).toContain('body.red-title .doc-title { color: #FF0000; }');
  });

  it('حدود جداوله سوداء رفيعة كالأصل', () => {
    expect(html()).toContain('table.form td {');
    expect(html()).toContain('border: 1px solid #000;');
  });

  it('المبلغ رقماً وكتابةً', () => {
    const out = html();
    expect(out).toContain('12,000');
    expect(out).toContain('اثنا عشر ألفاً');
  });

  it('خانات الايبان أربع وعشرون خانة بحروف الحساب', () => {
    const out = html();
    const match = out.match(/<div class="iban-boxes">([\s\S]*?)<\/div>/);
    expect(match).toBeTruthy();
    expect((match[1].match(/<span>/g) || []).length).toBe(24);
    expect(match[1]).toContain('>S<');
    expect(match[1]).toContain('>A<');
  });

  it('خاتمة النموذج كما في الصيغة', () => {
    const out = html();
    expect(out).toContain('مع التحية لمدير الإدارة المالية');
    expect(out).toContain('نأمل تحويل المستحقات المالية لصاحبها وفق البيانات المدونة أعلاه.');
    expect(out).toContain('وكيل الجامعة للتدريب');
  });
});

describe('شهادة إنجاز الترجمة', () => {
  const html = () => docs.renderInterpreterCertificate({ course: COURSE, interpreter: INTERPRETER });

  it('تحمل صيغة الشهادة المعتمدة', () => {
    const out = html();
    expect(out).toContain('السادة الكرام');
    expect(out).toContain('السلام عليكم ورحمة الله وبركاته');
    expect(out).toContain('تشهد وكالة التدريب بجامعة نايف العربية للعلوم الأمنية');
    expect(out).toContain('قد انجز جميع أعمال الترجمة الموكلة إليه ضمن الدورة التدريبية');
    expect(out).toContain('تقبلوا وافر التحايا');
    expect(out).toContain('المشرف العام على الدورة');
  });

  it('جدولها يحمل الدورة والمترجم', () => {
    const out = html();
    expect(out).toContain('تأمين القواعد والمعسكرات');
    expect(out).toContain('سالم بن أحمد العلي');
  });

  it('تاريخها بالأرقام العربية كما في الصيغة', () => {
    expect(html()).toContain('٢٠٢٦/١١/١٦');
  });

  it('تُطبع على مطبوعات الجامعة', () => {
    expect(html()).toContain('/letterhead-header.jpg');
  });
});

describe('رسالة طلب الصرف بالتحويل', () => {
  const html = () => docs.renderInterpreterTransferEmail({ course: COURSE, interpreter: INTERPRETER });

  it('تذكر الإنجاز وتطلب التحويل', () => {
    const out = html();
    expect(out).toContain('أنجز جميع أعمال الترجمة الموكلة إليه');
    expect(out).toContain('تحويل مستحقاته المالية');
  });

  it('تحمل المبلغ رقماً وكتابةً وبيانات الحساب', () => {
    const out = html();
    expect(out).toContain('12,000');
    expect(out).toContain('اثنا عشر ألفاً');
    expect(out).toContain('SA0000000000000000000002');
    expect(out).toContain('مصرف الراجحي');
  });

  it('تحمل توقيع منسق الدورة', () => {
    expect(html()).toContain('نايف الشهراني');
  });

  it('بلا مبلغ لا تذكر مبلغاً', () => {
    const out = docs.renderInterpreterTransferEmail({
      course: COURSE,
      interpreter: { ...INTERPRETER, amount: null },
    });
    expect(out).not.toContain('ريال</strong>');
  });

  it('لا تعتمد على خط خارجي — البريد لا يُحمّل الخطوط', () => {
    expect(html()).not.toContain('BoutrosJazirahTextLight.ttf');
  });

  it('خانة فارغة لا تظهر صفاً فارغاً', () => {
    const out = docs.renderInterpreterTransferEmail({
      course: COURSE,
      interpreter: { ...INTERPRETER, bankBranch: null, notes: null },
    });
    expect(out).not.toContain('الفرع');
    expect(out).not.toContain('ملاحظات');
  });
});

// ======================================================================
// رسائل العقد: المراجعة القانونية وطلبات الصرف
// ======================================================================

describe('رسالة الإدارة القانونية', () => {
  const html = () => docs.renderLegalReviewEmail({ course: COURSE, interpreter: INTERPRETER });

  it('تطلب المراجعة والاعتماد', () => {
    const out = html();
    expect(out).toContain('سعادة مدير الإدارة القانونية');
    expect(out).toContain('عقد تقديم خدمات أعمال الترجمة الفورية');
    expect(out).toContain('مراجعة العقد من الناحية النظامية واعتماده');
  });

  it('تحمل رقم العقد وبيانات البرنامج والمترجم', () => {
    const out = html();
    expect(out).toContain('0042/NAUSS/26');
    expect(out).toContain('تأمين القواعد والمعسكرات');
    expect(out).toContain('سالم بن أحمد العلي');
    expect(out).toContain('1000000002');
  });

  it('تحمل قيمة العقد رقماً وكتابةً ومدته', () => {
    const out = html();
    expect(out).toContain('12,000');
    expect(out).toContain('اثنا عشر ألفاً');
    expect(out).toContain('16 يوماً');
  });

  it('توقّعها باسم منسق البرنامج', () => {
    expect(html()).toContain('نايف الشهراني');
  });
});

describe('رسائل الإدارة المالية', () => {
  const first = () => docs.renderFinancePaymentEmail({ course: COURSE, interpreter: INTERPRETER, stage: 'FIRST' });
  const final = () => docs.renderFinancePaymentEmail({ course: COURSE, interpreter: INTERPRETER, stage: 'FINAL' });

  it('الدفعة الأولى تُسند إلى العقد وتوقيعه', () => {
    const out = first();
    expect(out).toContain('سعادة مدير الإدارة المالية');
    expect(out).toContain('0042/NAUSS/26');
    expect(out).toContain('صرف الدفعة الأولى بعد توقيعه');
  });

  it('بقية المستحقات تُسند إلى شهادة الإنجاز', () => {
    const out = final();
    expect(out).toContain('أنجز جميع أعمال الترجمة الموكلة إليه');
    expect(out).toContain('شهادة إنجاز');
    expect(out).toContain('بقية مستحقاته المالية');
  });

  it('كلتاهما تطلب نصف قيمة العقد رقماً وكتابةً', () => {
    for (const out of [first(), final()]) {
      expect(out).toContain('6,000');
      expect(out).toContain('ستة آلاف');
    }
  });

  it('كلتاهما تحمل بيانات الحساب وصفة الاستحقاق', () => {
    for (const out of [first(), final()]) {
      expect(out).toContain('SA0000000000000000000002');
      expect(out).toContain('مصرف الراجحي');
      expect(out).toContain('ترجمة فورية');
    }
  });

  it('الخانة الفارغة لا تظهر صفاً فارغاً', () => {
    const out = docs.renderFinancePaymentEmail({
      course: COURSE,
      interpreter: { ...INTERPRETER, bankBranch: null, notes: null },
      stage: 'FINAL',
    });
    expect(out).not.toContain('الفرع');
    expect(out).not.toContain('ملاحظات');
  });

  it('الرسائل لا تعتمد على خط خارجي', () => {
    expect(first()).not.toContain('BoutrosJazirahTextLight.ttf');
    expect(docs.renderLegalReviewEmail({ course: COURSE, interpreter: INTERPRETER }))
      .not.toContain('BoutrosJazirahTextLight.ttf');
  });
});
