// =============================================================
// تفقيط المبالغ — الرقم إلى كلمات عربية
// -------------------------------------------------------------
// عقد الترجمة ونموذج الاستحقاق المالي يطلبان المبلغ «رقماً وكتابة».
// وكتابته يداً باب خطأ: رقم في خانة وكلمات تخالفه في أخرى، في مستند
// مالي يُوقَّع. فنكتبها من الرقم نفسه، فلا تختلفان أبداً.
// =============================================================

const ONES = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة',
  'ستة', 'سبعة', 'ثمانية', 'تسعة',
];

const TEENS = [
  'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر',
  'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر',
];

const TENS = [
  '', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون',
  'ستون', 'سبعون', 'ثمانون', 'تسعون',
];

const HUNDREDS = [
  '', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة',
  'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة',
];

/**
 * الأرقام من ١ إلى ٩٩٩.
 * annexed: صيغة المضاف — «مائتا ألف» لا «مائتان ألف».
 */
function belowThousand(n, { annexed = false } = {}) {
  const parts = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds > 0) {
    parts.push(annexed && hundreds === 2 ? 'مائتا' : HUNDREDS[hundreds]);
  }

  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (ones > 0 && tens >= 2) parts.push(`${ONES[ones]} و${TENS[tens]}`);
    else if (tens >= 2) parts.push(TENS[tens]);
    else if (ones > 0) parts.push(ONES[ones]);
  }

  return parts.join(' و');
}

/**
 * صيغة الوحدة بحسب العدد — قاعدة العربية لا الإنجليزية.
 * والعدد الحاكم هو ما دون المائة منه:
 *   ١ → ألف، ٢ → ألفان، ٣-١٠ → ثلاثة آلاف، ١١-٩٩ → اثنا عشر ألفاً،
 *   ومضاعفات المائة → مائة ألف (مفرداً مضافاً إليه).
 */
function scaleWord(count, [singular, dual, plural, accusative]) {
  if (count === 1) return singular;
  if (count === 2) return dual;

  const governing = count % 100;
  const prefix = belowThousand(count, { annexed: true });

  if (governing === 0) return `${prefix} ${singular}`;
  if (governing >= 3 && governing <= 10) return `${prefix} ${plural}`;
  return `${prefix} ${accusative}`;
}

const THOUSAND = ['ألف', 'ألفان', 'آلاف', 'ألفاً'];
const MILLION = ['مليون', 'مليونان', 'ملايين', 'مليوناً'];
const BILLION = ['مليار', 'ملياران', 'مليارات', 'ملياراً'];

/** الرقم الصحيح إلى كلمات (حتى ما دون الترليون) */
function integerToArabicWords(value) {
  const n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'صفر';

  const parts = [];
  const billions = Math.floor(n / 1000000000);
  const millions = Math.floor((n % 1000000000) / 1000000);
  const thousands = Math.floor((n % 1000000) / 1000);
  const rest = n % 1000;

  if (billions > 0) parts.push(scaleWord(billions, BILLION));
  if (millions > 0) parts.push(scaleWord(millions, MILLION));
  if (thousands > 0) parts.push(scaleWord(thousands, THOUSAND));
  if (rest > 0) parts.push(belowThousand(rest));

  return parts.join(' و');
}

/**
 * المبلغ كما يُكتب في المستند المالي.
 * مثال: 12000 → «اثنا عشر ألفاً ريال سعودي لا غير»
 */
function amountInWords(value, { currency = 'ريال سعودي', suffix = 'لا غير' } = {}) {
  // الفارغ ليس صفراً: المستند المالي لا يُكتب فيه مبلغ لم يُحدَّد
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '';

  const riyals = Math.floor(num);
  const halalas = Math.round((num - riyals) * 100);

  let text = integerToArabicWords(riyals);
  if (halalas > 0) {
    text += ` و${integerToArabicWords(halalas)} هللة`;
  }

  return [text, currency, suffix].filter(Boolean).join(' ');
}

/** الرقم بالأرقام العربية الهندية — للشهادات والنماذج الرسمية */
function toArabicDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

/** المبلغ بفواصل الآلاف */
function formatAmount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

module.exports = {
  integerToArabicWords,
  amountInWords,
  toArabicDigits,
  formatAmount,
};
