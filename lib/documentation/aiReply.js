// ======================================================================
// قراءة رد أداة الذكاء الاصطناعي التي يستخدمها المنسق
// ----------------------------------------------------------------------
// حين لا يكون المساعد مفعّلاً على الخادم ينسخ المنسق «طلباً جاهزاً» إلى
// أداته، ثم يلصق ردها هنا. الرد: فقرة لكل جلسة تبدأ برقمها («3: …»).
// نقبل الصيغ الشائعة: «3:» «3.» «3)» «الجلسة 3 —» «**3.**» والأرقام العربية.
// ======================================================================

const AR = '٠١٢٣٤٥٦٧٨٩';
const toWestern = (s) => String(s).replace(/[٠-٩]/g, (d) => AR.indexOf(d));

const HEAD = /^\s*(?:[*_#>\-•]+\s*)?(?:الجلسة|جلسة|session)?\s*(?:رقم\s*)?\(?([0-9٠-٩]{1,2})\)?\s*(?:[*_]+\s*)?[:：.)\-–—]\s*(?:[*_]+\s*)?(.*)$/i;

/** ينظّف الفقرة من علامات التنسيق ومن إعادة عنوان الجلسة في أولها */
function clean(text) {
  return String(text || '')
    .replace(/\*\*|__/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/**
 * @param {string} reply   الرد الملصوق
 * @param {number} count   عدد الجلسات في الصفحة
 * @returns {Object<number,string>} index (يبدأ من ٠) ← نص الفقرة
 */
export function parseNumberedReply(reply, count) {
  const out = {};
  let current = null;
  let buf = [];
  const flush = () => {
    if (current !== null) {
      const t = clean(buf.join('\n'));
      if (t.length >= 10) out[current] = t.slice(0, 1200);
    }
    buf = [];
  };
  for (const line of String(reply || '').split(/\r?\n/)) {
    const m = line.match(HEAD);
    const n = m ? Number(toWestern(m[1])) : NaN;
    if (m && n >= 1 && n <= count) {
      flush();
      current = n - 1;
      if (m[2]) buf.push(m[2]);
    } else if (current !== null && line.trim()) {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/** رد نص واحد (ترحيب، مقدمة، خاتمة): يُزال ما قد تضيفه الأداة حوله */
export function cleanSingleReply(reply) {
  return String(reply || '')
    .replace(/^\s*(?:إليك|هذه|هذا)[^\n]{0,60}[:：]\s*\n/, '')
    .replace(/\*\*|__/g, '')
    .replace(/^["«“\s]+|["»”\s]+$/g, '')
    .trim();
}
