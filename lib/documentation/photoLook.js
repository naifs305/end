// ======================================================================
// مظهر صورة التوثيق — تعديل لا يمسّ الأصل
// ----------------------------------------------------------------------
// القصّ والفلتر والإضاءة تُحفظ أرقاماً بجوار الصورة، وتُطبَّق عند العرض
// والطباعة على الأصل نفسه. فلا تُعاد كتابة الصورة ولا تفقد شيئاً من
// جودتها مهما عُدّلت، ويُرجَع عن أي تعديل في أي وقت.
//
//   crop  : الجزء المختار من الصورة {x,y,w,h} بنسب من ٠ إلى ١ (الكل افتراضياً)
//   fit   : cover = يملأ إطار المجلة | contain = الصورة كاملة بلا قصّ
//           (وخلفها نسخة مموّهة منها تملأ الفراغ)
//   x, y  : موضع التركيز داخل الجزء المختار، إن اختلف شكل الإطار عن شكله.
//           افتراضياً في الثلث الأعلى، فتبقى الرؤوس والوجوه لا الأجسام وحدها.
// ======================================================================

const DEFAULT_FOCUS = { x: 0.5, y: 0.32 };
const FULL = { x: 0, y: 0, w: 1, h: 1 };

// فلاتر مصمّمة لصور الأشخاص والقاعات: مصفوفة لون ومضاعفات معتدلة.
// الترتيب عند التطبيق: سطوع وتشبّع ← مصفوفة اللون ← تباين.
const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const FILTERS = [
  { id: 'none', label: 'الأصل', matrix: IDENTITY, offset: [0, 0, 0], b: 1, c: 1, s: 1 },
  { id: 'clear', label: 'وضوح', hint: 'تباين ألطف ووجوه أوضح', matrix: IDENTITY, offset: [0.01, 0.01, 0.01], b: 1.04, c: 1.1, s: 1.06 },
  { id: 'warm', label: 'دافئ', hint: 'دفء ذهبي يُحيي البشرة', matrix: [[1.07, 0.02, 0], [0.01, 1.01, 0], [0, 0, 0.88]], offset: [0.014, 0.007, 0], b: 1.03, c: 1.04, s: 1.06 },
  { id: 'bright', label: 'مشرق', hint: 'لصور القاعات المعتمة', matrix: [[0.98, 0.01, 0.01], [0, 1, 0.01], [0.01, 0.02, 1.04]], offset: [0.02, 0.02, 0.025], b: 1.1, c: 1.03, s: 1.06 },
  { id: 'soft', label: 'ناعم', hint: 'إضاءة ناعمة للوجوه', matrix: [[1.02, 0.01, 0], [0, 1.01, 0], [0, 0.01, 0.98]], offset: [0.035, 0.03, 0.03], b: 1.06, c: 0.92, s: 0.94 },
  { id: 'vivid', label: 'زاهٍ', hint: 'ألوان أغنى بلا مبالغة', matrix: [[1.03, -0.01, -0.01], [-0.01, 1.03, -0.01], [-0.01, -0.01, 1.03]], offset: [0, 0, 0], b: 1.02, c: 1.08, s: 1.2 },
  { id: 'cinema', label: 'سينمائي', hint: 'ظلال عميقة وبشرة دافئة', matrix: [[1.12, -0.06, -0.03], [-0.03, 1.05, -0.01], [-0.1, 0.08, 1.06]], offset: [0, 0.01, 0.035], b: 1, c: 1.14, s: 1 },
  { id: 'mono', label: 'أبيض وأسود', hint: 'طابع رسمي كلاسيكي', matrix: [[0.3, 0.59, 0.11], [0.3, 0.59, 0.11], [0.3, 0.59, 0.11]], offset: [0.01, 0.01, 0.01], b: 1.03, c: 1.12, s: 1 },
];
const FILTER_IDS = new Set(FILTERS.map((f) => f.id));
const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

const num = (v, lo, hi, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
};
const round = (n, p = 4) => Math.round(n * 10 ** p) / 10 ** p;

function cleanCrop(c) {
  if (!c || typeof c !== 'object') return { ...FULL };
  const w = num(c.w, 0.05, 1, 1);
  const h = num(c.h, 0.05, 1, 1);
  return { x: round(num(c.x, 0, 1 - w, 0)), y: round(num(c.y, 0, 1 - h, 0)), w: round(w), h: round(h) };
}

/** تنظيف ما يرسله المتصفح: أرقام في حدودها وفلتر معروف، وما سواها يسقط */
function cleanEdit(edit) {
  if (!edit || typeof edit !== 'object') return null;
  return {
    x: round(num(edit.x, 0, 1, DEFAULT_FOCUS.x), 3),
    y: round(num(edit.y, 0, 1, DEFAULT_FOCUS.y), 3),
    crop: cleanCrop(edit.crop),
    fit: edit.fit === 'contain' ? 'contain' : 'cover',
    filter: FILTER_IDS.has(edit.filter) ? edit.filter : 'none',
    b: round(num(edit.b, 0.6, 1.6, 1), 2),
    c: round(num(edit.c, 0.6, 1.6, 1), 2),
    s: round(num(edit.s, 0, 1.8, 1), 2),
    // ضُغطت الصورة بعد النشر: القصّ والفلتر صارا جزءاً منها
    ...(edit.baked === true ? { baked: true } : {}),
  };
}

function lookOf(edit) {
  const e = { ...DEFAULT_FOCUS, fit: 'cover', filter: 'none', b: 1, c: 1, s: 1, ...(edit || {}) };
  e.crop = cleanCrop(e.crop);
  return e;
}

const isPristine = (e) => {
  const l = lookOf(e);
  return l.filter === 'none' && l.fit === 'cover' && l.b === 1 && l.c === 1 && l.s === 1
    && l.x === DEFAULT_FOCUS.x && l.y === DEFAULT_FOCUS.y
    && l.crop.x === 0 && l.crop.y === 0 && l.crop.w === 1 && l.crop.h === 1;
};

/** قيمة filter في CSS — الترتيب نفسه في كل مكان */
function cssFilter(edit) {
  const e = lookOf(edit);
  const f = filterById(e.filter);
  const b = round(e.b * f.b, 3);
  const s = round(e.s * f.s, 3);
  const c = round(e.c * f.c, 3);
  const parts = [];
  if (b !== 1) parts.push(`brightness(${b})`);
  if (s !== 1) parts.push(`saturate(${s})`);
  if (f.id !== 'none') parts.push(`url(#nfx-${f.id})`);
  if (c !== 1) parts.push(`contrast(${c})`);
  return parts.length ? parts.join(' ') : undefined;
}

/** نسبة عرض الصورة إلى ارتفاعها بعد القصّ */
function ratioOf(m) {
  const W = Number(m?.width) || 4;
  const H = Number(m?.height) || 3;
  const c = lookOf(m?.edit).crop;
  return (W * c.w) / (H * c.h);
}

/** اتجاه الصورة بعد القصّ: عرضية أو طولية أو مربعة */
function orientation(m) {
  const r = ratioOf(m);
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

/**
 * أنماط عرض الصورة داخل إطار أياً كان شكله، بلا قياس بالجافاسكربت:
 * الإطار «حاوية» (container-type: size)، وصندوق القصّ يُحسب بوحدات cqw/cqh.
 *   frame  : على العنصر المحيط (يملأ الإطار)
 *   box    : صندوق الجزء المختار — يغطي الإطار (cover) أو يُحتوى فيه (contain)
 *   img    : الصورة كاملة مزاحة داخل الصندوق بحيث يظهر الجزء المختار وحده
 *   backdrop: نسخة مموّهة تملأ الفراغ في وضع «الصورة كاملة»
 */
function photoStyles(m) {
  const e = lookOf(m?.edit);
  const r = round(ratioOf(m), 5);
  const { crop } = e;
  const fn = e.fit === 'contain' ? 'min' : 'max';
  const bw = `${fn}(100cqw, calc(100cqh * ${r}))`;
  const bh = `${fn}(100cqh, calc(100cqw / ${r}))`;
  const fx = e.fit === 'contain' ? 0.5 : e.x;
  const fy = e.fit === 'contain' ? 0.5 : e.y;
  const filter = cssFilter(e);
  return {
    frame: { position: 'absolute', inset: 0, overflow: 'hidden', containerType: 'size' },
    box: {
      position: 'absolute', overflow: 'hidden', width: bw, height: bh,
      left: `calc((100cqw - ${bw}) * ${fx})`, top: `calc((100cqh - ${bh}) * ${fy})`,
    },
    img: {
      position: 'absolute', display: 'block', maxWidth: 'none', objectFit: 'fill',
      width: `${round(100 / crop.w, 3)}%`, height: `${round(100 / crop.h, 3)}%`,
      left: `${round((-crop.x / crop.w) * 100, 3)}%`, top: `${round((-crop.y / crop.h) * 100, 3)}%`,
      ...(filter ? { filter } : {}),
    },
    backdrop: e.fit === 'contain'
      ? { position: 'absolute', inset: '-8%', width: '116%', height: '116%', objectFit: 'cover', filter: `blur(14px) brightness(0.8) saturate(1.1)${filter ? ` ${filter}` : ''}`, transform: 'scale(1.05)' }
      : null,
  };
}

/** تعريفات مصفوفات الألوان (SVG) — تُدرج مرة في كل صفحة تعرض الصور */
function filterDefsMarkup() {
  const defs = FILTERS.filter((f) => f.id !== 'none').map((f) => {
    const rows = f.matrix.map((row, i) => [...row, 0, f.offset[i]].join(' '));
    const values = [...rows, '0 0 0 1 0'].join(' ');
    return `<filter id="nfx-${f.id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${values}"/></filter>`;
  }).join('');
  return `<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${defs}</defs></svg>`;
}

/**
 * تحسين تلقائي من إحصاءات الصورة (متوسط الإضاءة وانتشارها):
 * صورة معتمة تُرفع إضاءتها، وباهتة يُزاد تباينها — باعتدال.
 */
function autoEnhance({ mean, spread }) {
  const m = num(mean, 0.02, 0.98, 0.5);
  const sd = num(spread, 0.01, 0.5, 0.22);
  return {
    b: round(num(0.5 / m, 0.9, 1.35, 1), 2),
    c: round(num(0.22 / sd, 0.95, 1.3, 1), 2),
    s: 1.06,
  };
}

module.exports = {
  DEFAULT_FOCUS, FULL, FILTERS, cleanEdit, cleanCrop, lookOf, isPristine, cssFilter, ratioOf, orientation, photoStyles,
  filterDefsMarkup, autoEnhance,
};
