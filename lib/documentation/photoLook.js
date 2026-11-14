// ======================================================================
// مظهر صورة التوثيق — تعديل لا يمسّ الأصل
// ----------------------------------------------------------------------
// موضع التركيز والتقريب والفلتر تُحفظ أرقاماً بجوار الصورة، وتُطبَّق
// عند العرض والطباعة على الأصل نفسه. فلا تُعاد كتابة الصورة ولا تفقد
// شيئاً من جودتها مهما عُدّلت، ويمكن الرجوع عن أي تعديل في أي وقت.
//
// موضع التركيز الافتراضي في الثلث الأعلى: حين يُقصّ إطار عريض من صورة
// طولية تبقى الرؤوس والوجوه، لا الأجسام وحدها.
// ======================================================================

const DEFAULT_FOCUS = { x: 0.5, y: 0.32 };

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
const round = (n, p = 3) => Math.round(n * 10 ** p) / 10 ** p;

/** تنظيف ما يرسله المتصفح: أرقام في حدودها وفلتر معروف، وما سواها يسقط */
function cleanEdit(edit) {
  if (!edit || typeof edit !== 'object') return null;
  const out = {
    x: round(num(edit.x, 0, 1, DEFAULT_FOCUS.x)),
    y: round(num(edit.y, 0, 1, DEFAULT_FOCUS.y)),
    zoom: round(num(edit.zoom, 1, 3, 1), 2),
    filter: FILTER_IDS.has(edit.filter) ? edit.filter : 'none',
    b: round(num(edit.b, 0.6, 1.6, 1), 2),
    c: round(num(edit.c, 0.6, 1.6, 1), 2),
    s: round(num(edit.s, 0, 1.8, 1), 2),
  };
  return out;
}

function lookOf(edit) {
  return { ...DEFAULT_FOCUS, zoom: 1, filter: 'none', b: 1, c: 1, s: 1, ...(edit || {}) };
}

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

/** نمط الصورة داخل إطارها (object-fit: cover) */
function imgStyle(edit) {
  const e = lookOf(edit);
  const pos = `${round(e.x * 100, 1)}% ${round(e.y * 100, 1)}%`;
  const style = { objectFit: 'cover', objectPosition: pos };
  if (e.zoom > 1.001) { style.transform = `scale(${e.zoom})`; style.transformOrigin = pos; }
  const filter = cssFilter(e);
  if (filter) style.filter = filter;
  return style;
}

/** تعريفات مصفوفات الألوان (SVG) — تُدرج مرة في كل صفحة تعرض الصور */
function filterDefsMarkup() {
  const defs = FILTERS.filter((f) => f.id !== 'none').map((f) => {
    const rows = f.matrix.map((r, i) => [...r, 0, f.offset[i]].join(' '));
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

/** اتجاه الصورة: عرضية أو طولية أو مربعة */
function orientation(m) {
  const r = (Number(m?.width) || 1) / (Number(m?.height) || 1);
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

module.exports = {
  DEFAULT_FOCUS, FILTERS, cleanEdit, lookOf, cssFilter, imgStyle, filterDefsMarkup, autoEnhance, orientation,
};
