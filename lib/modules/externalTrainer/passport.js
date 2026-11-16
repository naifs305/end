// ======================================================================
// قراءة بيانات المدرب من جواز سفره
// ----------------------------------------------------------------------
// يقرأ المساعد صورة الجواز (أو ملف PDF) فيستخرج الحقول وسطري المنطقة
// المقروءة آلياً (MRZ) أسفل صفحة البيانات. ثم نتحقق من السطرين بأرقام
// التحقق المعيارية (ICAO 9303): إن صحّت اعتُمدت قيمها لرقم الجواز
// والتواريخ لأنها أدق من قراءة النص المطبوع، وإن لم تصح نُبّه المنسق
// لمراجعة الحقول بنفسه.
// الصورة لا تُحفظ في المنصة: تُرسل للقراءة ثم تُهمل، ويُحفظ ما يعتمده
// المنسق من حقول فقط.
// ======================================================================

const WEIGHTS = [7, 3, 1];

/** رقم التحقق المعياري لحقل في المنطقة المقروءة آلياً */
function checkDigit(field) {
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const c = field[i];
    let v = 0;
    if (c >= '0' && c <= '9') v = c.charCodeAt(0) - 48;
    else if (c >= 'A' && c <= 'Z') v = c.charCodeAt(0) - 55;
    sum += v * WEIGHTS[i % 3];
  }
  return String(sum % 10);
}

/** تنظيف سطر قرأه المساعد: حروف كبيرة، بلا مسافات، و«<» لكل ما يشبهها */
function normLine(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[«‹〈＜]/g, '<')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9<]/g, '');
}

// خانة رقمية قرأها النموذج حرفاً متشابهاً
const DIGITISH = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
const asDigits = (s) => s.replace(/[A-Z]/g, (c) => DIGITISH[c] || c);

function mrzDate(yymmdd, { future }) {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return '';
  const nowYY = new Date().getUTCFullYear() % 100;
  // تاريخ الانتهاء في المستقبل غالباً، وتاريخ الميلاد في الماضي
  const century = future ? (yy < nowYY - 30 ? 2100 : 2000) : (yy > nowYY ? 1900 : 2000);
  return `${century + yy}-${mm}-${dd}`;
}

/**
 * يحلل سطري جواز السفر (TD3: سطران × ٤٤ خانة).
 * يعيد الحقول ونتيجة كل رقم تحقق، أو null إن لم يكن السطران بهيئة جواز.
 */
function parseMrz(line1, line2) {
  let a = normLine(line1);
  let b = normLine(line2);
  if (!a.startsWith('P') || a.length < 30 || b.length < 28) return null;
  a = (a + '<'.repeat(44)).slice(0, 44);
  b = (b + '<'.repeat(44)).slice(0, 44);

  const numberField = b.slice(0, 9);
  const birth = asDigits(b.slice(13, 19));
  const expiry = asDigits(b.slice(21, 27));
  const checks = {
    number: checkDigit(numberField) === asDigits(b[9]),
    birth: checkDigit(birth) === asDigits(b[19]),
    expiry: checkDigit(expiry) === asDigits(b[27]),
    // الرقم المركّب يغطي رقم الجواز والميلاد والانتهاء والرقم الشخصي معاً
    composite: checkDigit(b.slice(0, 10) + birth + asDigits(b[19]) + expiry + asDigits(b[27]) + b.slice(28, 43)) === asDigits(b[43]),
  };

  const [surname = '', given = ''] = a.slice(5).split('<<');
  const name = (s) => s.split('<').filter(Boolean).join(' ');
  const sex = b[20] === 'M' || b[20] === 'F' ? b[20] : '';

  return {
    issuer: a.slice(2, 5).replace(/</g, ''),
    surname: name(surname),
    givenNames: name(given),
    nameEn: [name(given), name(surname)].filter(Boolean).join(' '),
    passportNo: numberField.replace(/</g, ''),
    nationalityCode: b.slice(10, 13).replace(/</g, ''),
    birthDate: mrzDate(birth, { future: false }),
    sex,
    expiry: mrzDate(expiry, { future: true }),
    checks,
    valid: checks.number && checks.birth && checks.expiry && checks.composite,
  };
}

const SCHEMA = {
  type: 'object',
  properties: {
    isPassport: { type: 'boolean' },
    mrzLine1: { type: 'string' },
    mrzLine2: { type: 'string' },
    nameEn: { type: 'string' },
    nameAr: { type: 'string' },
    nationality: { type: 'string' },
    passportNo: { type: 'string' },
    birthDate: { type: 'string' },
    expiry: { type: 'string' },
    sex: { type: 'string', enum: ['M', 'F', ''] },
    issuingCountry: { type: 'string' },
  },
  required: ['isPassport', 'mrzLine1', 'mrzLine2', 'nameEn', 'nameAr', 'nationality', 'passportNo', 'birthDate', 'expiry', 'sex', 'issuingCountry'],
  additionalProperties: false,
};

const SYSTEM = `تقرأ صفحة بيانات جواز سفر لتعبئة بيانات مدرب يسافر لتقديم دورة في جامعة نايف العربية للعلوم الأمنية.
- انقل سطري المنطقة المقروءة آلياً (MRZ) أسفل الصفحة حرفاً حرفاً كما هما، ٤٤ خانة لكل سطر، مع علامات «<» كاملة، وبلا مسافات. لا تصحّح ولا تخمّن خانة؛ إن تعذّرت قراءة السطرين فاتركهما فارغين.
- nameEn: الاسم باللاتينية كما في الجواز، الاسم الأول ثم اسم العائلة، بحروف كبيرة.
- nameAr: الاسم بالعربية إن كان مطبوعاً في الجواز، وإلا فارغ (لا تترجم ولا تكتب الاسم بحروف عربية من عندك).
- nationality: الجنسية بالعربية بصيغة النسبة (مثل: مصري، أردني، بريطاني، إسبانية).
- التواريخ بصيغة YYYY-MM-DD، و sex إما M أو F.
- إن لم تكن الصورة صفحة بيانات جواز سفر فاجعل isPassport خطأ واترك الحقول فارغة.`;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024;

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

/** يتحقق من الملف المرفوع (رابط بيانات) ويعيد جزء المحتوى المناسب للمساعد */
function toContent(file) {
  const m = String(file || '').match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) throw httpError(400, 'أرفق صورة الجواز أو ملف PDF', 'serverErrors.trainer.passportInvalid');
  const type = m[1].toLowerCase();
  if (Buffer.byteLength(m[2], 'base64') > MAX_BYTES) throw httpError(400, 'حجم الملف أكبر من ٨ ميجابايت', 'serverErrors.trainer.passportTooLarge');
  if (type === 'application/pdf') return { type: 'document', source: { type: 'base64', media_type: type, data: m[2] } };
  if (IMAGE_TYPES.includes(type)) return { type: 'image', source: { type: 'base64', media_type: type, data: m[2] } };
  throw httpError(400, 'الصيغة غير مدعومة — صورة (JPG أو PNG) أو PDF', 'serverErrors.trainer.passportType');
}

const isoDate = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * يجمع قراءة المساعد مع تحليل السطرين: ما صحّت أرقام تحققه يُعتمد.
 * courseEnd: لتنبيه المنسق إن قاربت صلاحية الجواز على الانتهاء.
 */
function reconcile(out, { courseEnd } = {}) {
  if (!out?.isPassport) throw httpError(422, 'لم يُتعرّف على صفحة بيانات جواز سفر — صوّر الصفحة كاملة بإضاءة جيدة', 'serverErrors.trainer.passportNotFound');
  const mrz = parseMrz(out.mrzLine1, out.mrzLine2);
  const fields = {
    nameEn: clip(out.nameEn, 160).toUpperCase(),
    nameAr: clip(out.nameAr, 160),
    nationality: clip(out.nationality, 80),
    passportNo: clip(out.passportNo, 30).toUpperCase().replace(/\s+/g, ''),
    passportExpiry: isoDate(out.expiry),
    birthDate: isoDate(out.birthDate),
    sex: out.sex === 'M' || out.sex === 'F' ? out.sex : '',
  };
  const warnings = [];
  let verified = false;

  if (mrz) {
    if (mrz.checks.number && mrz.passportNo) fields.passportNo = mrz.passportNo;
    if (mrz.checks.expiry && mrz.expiry) fields.passportExpiry = mrz.expiry;
    if (mrz.checks.birth && mrz.birthDate) fields.birthDate = mrz.birthDate;
    if (mrz.sex) fields.sex = mrz.sex;
    if (!fields.nameEn && mrz.nameEn) fields.nameEn = mrz.nameEn;
    verified = mrz.valid;
    if (!mrz.valid) warnings.push('لم تتطابق أرقام التحقق في أسفل الجواز — راجع رقم الجواز والتواريخ مع الصورة');
  } else {
    warnings.push('لم يُقرأ السطران أسفل الجواز — راجع الحقول مع الصورة');
  }

  if (fields.passportExpiry && courseEnd) {
    const end = new Date(courseEnd);
    const limit = new Date(end.getTime());
    limit.setUTCMonth(limit.getUTCMonth() + 6);
    const exp = new Date(`${fields.passportExpiry}T00:00:00Z`);
    if (exp < end) warnings.push('الجواز ينتهي قبل نهاية الدورة');
    else if (exp < limit) warnings.push('صلاحية الجواز أقل من ستة أشهر بعد الدورة، وتشترطها دول كثيرة للسفر');
  }

  return { fields, verified, warnings, mrz: mrz ? { issuer: mrz.issuer, nationalityCode: mrz.nationalityCode, checks: mrz.checks } : null };
}

/** يقرأ الجواز بالمساعد ثم يطابق القراءة بأرقام التحقق */
async function readPassport({ file, courseEnd }, ai = require('../documentation/documentation.ai')) {
  const content = [toContent(file), { type: 'text', text: 'اقرأ صفحة بيانات هذا الجواز.' }];
  const out = await ai.askJson({ system: SYSTEM, content, schema: SCHEMA, effort: 'high', maxTokens: 4000 });
  return reconcile(out, { courseEnd });
}

module.exports = { checkDigit, parseMrz, reconcile, toContent, readPassport };
