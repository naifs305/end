// ======================================================================
// اللصق الذكي لجدول الدورة المنسوخ من منصة التدريب (LMS)
// ----------------------------------------------------------------------
// يقرأ النص كما يُنسخ من الصفحة: رؤوس الأيام وتواريخها، ثم عنوان كل جلسة
// يليه سطر وقتها «8:00 ص - 8:30 ص (30 دقيقة)»، وبينها سطور ضجيج
// (أيقونات، روابط، ملفات، الحضور…) تُتجاهل. ويقبل كذلك الجدول المنسوخ
// صفوفاً (خلايا بينها مسافة جدولة) والأرقام العربية والوقت بنظام ٢٤ ساعة.
//
// يعمل في المتصفح والخادم معاً، بلا أي خدمة خارجية.
// ======================================================================

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const MONTHS = {
  يناير: 1, فبراير: 2, مارس: 3, أبريل: 4, ابريل: 4, إبريل: 4, مايو: 5, يونيو: 6, يوليو: 7, أغسطس: 8, اغسطس: 8,
  سبتمبر: 9, أكتوبر: 10, اكتوبر: 10, نوفمبر: 11, ديسمبر: 12,
};

function normalize(text) {
  return String(text || '')
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d))
    .replace(/[۰-۹]/g, (d) => FA_DIGITS.indexOf(d))
    .replace(/[‎‏‪-‮⁦-⁩]/g, '')
    .replace(/ /g, ' ')
    .replace(/\r/g, '');
}

/** عنوان نظيف: يُحذف الترقيم اليدوي في أوله، و«+» تصير واو عطف، وتُحذف النقطة الختامية */
function cleanSessionTitle(title) {
  let t = String(title || '').replace(/[ \t]+/g, ' ').replace(/ +([،,.:؛;!?؟])/g, '$1').trim();
  t = t.replace(/^(?:(?:الجلسة|المحور)\s*)?[([]?[0-9]{1,3}\s*[)\].\-–—:/]\s*/u, '');
  t = t.replace(/^(?:الجلسة|المحور)\s+[0-9]{1,3}\s+/u, '');
  t = t.replace(/\s*\+\s*/g, ' و');
  t = t.replace(/[\s.。،,:؛-]+$/u, '');
  return t.replace(/ {2,}/g, ' ').trim();
}

const pad = (n) => String(n).padStart(2, '0');
const validDate = (y, m, d) => y > 2000 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;

function findDate(line) {
  let m = line.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m && validDate(+m[1], +m[2], +m[3])) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  m = line.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m && validDate(+m[3], +m[2], +m[1])) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = line.match(/(\d{1,2})\s+([؀-ۿ]+)\s+(\d{4})/);
  if (m && MONTHS[m[2]] && validDate(+m[3], MONTHS[m[2]], +m[1])) return `${m[3]}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  return null;
}

const MER = '(ص|م|صباحا|صباحاً|مساء|مساءً|ظهرا|ظهراً|am|pm|AM|PM|a\\.m\\.|p\\.m\\.)';
const TIME_RE = new RegExp(`(\\d{1,2})[:٫.](\\d{2})\\s*${MER}?\\s*(?:-|–|—|إلى|الى|حتى|to)\\s*(\\d{1,2})[:٫.](\\d{2})\\s*${MER}?`);

function to24(h, m, mer) {
  let hour = Number(h);
  const pm = mer && /^(م|مساء|مساءً|ظهرا|ظهراً|pm|PM|p\.m\.)$/.test(mer);
  const am = mer && /^(ص|صباحا|صباحاً|am|AM|a\.m\.)$/.test(mer);
  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;
  return `${pad(hour)}:${pad(m)}`;
}

function findTime(line) {
  const m = line.match(TIME_RE);
  if (!m) return null;
  // إن ذُكر النظام في طرف واحد («8:00 - 9:30 م») فهو للطرفين
  const merA = m[3] || m[6];
  const merB = m[6] || m[3];
  const start = to24(m[1], m[2], merA);
  let end = to24(m[4], m[5], merB);
  // «11:30 ص - 1:00 م» صحيحة؛ أما «11:30 - 1:00» بلا نظام فنهايتها بعد الظهر
  if (!merA && !merB && end < start && Number(m[4]) < 12) end = to24(Number(m[4]) + 12, m[5]);
  return { label: `${start} - ${end}`, start, end, match: m[0] };
}

const NOISE = [
  /أيقونة/, /مشاهدة\s*الطلاب/, /^الحضور$/, /الحضور\s*و\s*الغياب/, /\bQR\b/i, /رابط\s*(إ|ا)لكتروني/, /^https?:\/\//i, /www\./i,
  /\.(pdf|pptx?|docx?|xlsx?|mp4|zip)\b/i, /ملف$/, /^(تحميل|تنزيل|عرض|معاينة|فتح|تعديل|حذف|المزيد|إخفاء)$/,
  /^\(?\d+\s*(دقيقة|دقائق|ساعة|ساعات)\)?$/, /^[\d\s:.\-–—()/]+$/, /^(ص|م)$/,
  /^(السبت|الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)$/,
];
const isNoise = (line) => !line || line.length < 3 || !/[؀-ۿa-zA-Z]/.test(line) || NOISE.some((r) => r.test(line));

// فترات ليست جلسات تدريبية
const BREAK_RE = /^(استراحة|استراحه|راحة|صلاة|الصلاة|غداء|الغداء|وجبة|إفطار|افطار|فطور|القهوة|استراحة\s*قهوة|coffee|break|lunch|prayer)/i;
const REVIEW_RE = /مراجعة\s*و\s*تطبيقات\s*عملية/;

const DAY_RE = /^(اليوم|يوم)\s*(\d+|الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)\b/;
const WEEKDAY_RE = /^(السبت|الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة)\b/;
const PRESENTER_RE = /^(المدرب|المدربة|المحاضر|المحاضرة|المقدم|المقدّم|مقدم الجلسة|مقدّم الجلسة|المتحدث|المتحدثة|الخبير|تقديم)\s*[:：\-–]\s*(.+)$/;

function stripForTitle(line, time) {
  return line
    .replace(time ? time.match : /$^/, ' ')
    .replace(/\(\s*\d+\s*(دقيقة|دقائق|ساعة|ساعات)\s*\)/g, ' ')
    .replace(/\d+\s*(دقيقة|دقائق)/g, ' ')
    .replace(/[|•·]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * يستخرج الجلسات من نص منسوخ.
 * يعيد [{ title, date: 'YYYY-MM-DD'|null, time: 'HH:MM - HH:MM'|null, presenter|null }]
 */
function parseLmsSchedule(text) {
  const lines = normalize(text).split(/\n|\t/).map((l) => l.replace(/\s+/g, ' ').trim());
  const out = [];
  let date = null;
  let candidate = '';

  for (const raw of lines) {
    if (!raw) continue;
    const time = findTime(raw);
    const d = findDate(raw);

    // رأس يوم: «يوم 1 (13-07-2026)» أو «الأحد 13/07/2026» أو تاريخ وحده
    if (!time && (d || DAY_RE.test(raw) || WEEKDAY_RE.test(raw))) {
      const rest = raw.replace(DAY_RE, '').replace(WEEKDAY_RE, '').replace(/[()،,\-–—/.\d\s]+/g, '').replace(/[؀-ۿ]+\s*\d{4}/, '');
      if (d) date = d;
      if (d || !rest || rest.length < 4) { candidate = ''; continue; }
    }

    const presenter = raw.match(PRESENTER_RE);
    if (presenter && !time) {
      const name = presenter[2].trim();
      // بعد وقت الجلسة فهو لمقدّمها، وقبله يُحفظ للجلسة القادمة
      const last = out[out.length - 1];
      if (last && !candidate && !last.presenter) last.presenter = name.slice(0, 120);
      continue;
    }

    if (time) {
      const inline = stripForTitle(raw, time).replace(/^[-–—:،,\s]+|[-–—:،,\s]+$/g, '');
      const title = cleanSessionTitle(!isNoise(inline) && inline.length >= 3 && !findDate(inline) ? inline : candidate);
      candidate = '';
      if (!title || isNoise(title) || BREAK_RE.test(title) || REVIEW_RE.test(title)) continue;
      const prev = out[out.length - 1];
      // الجلسة الواحدة المقسومة على فترتين متتاليتين تُضمّ
      if (prev && prev.title === title && prev.date === (d || date) && prev.time && prev.time.split(' - ')[1] <= time.start) {
        prev.time = `${prev.time.split(' - ')[0]} - ${time.end}`;
        continue;
      }
      out.push({ title: title.slice(0, 200), date: d || date, time: time.label, presenter: null });
      continue;
    }

    if (!isNoise(raw)) candidate = raw;
  }
  return out;
}

module.exports = { parseLmsSchedule, cleanSessionTitle, findTime, findDate };
