// دوال الترجمة الصافية (بلا React) — يستعملها مكوّن AutoTranslate وتُختبر وحدها
const AR = /[؀-ۿ]/;
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NOSCRIPT']);
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '٬': ',' };
const MONTHS = {
  يناير: 'January', فبراير: 'February', مارس: 'March', أبريل: 'April', إبريل: 'April', مايو: 'May', يونيو: 'June',
  يوليو: 'July', أغسطس: 'August', سبتمبر: 'September', أكتوبر: 'October', نوفمبر: 'November', ديسمبر: 'December',
};
const DAYS = { الأحد: 'Sunday', الاثنين: 'Monday', الإثنين: 'Monday', الثلاثاء: 'Tuesday', الأربعاء: 'Wednesday', الخميس: 'Thursday', الجمعة: 'Friday', السبت: 'Saturday' };

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const latinDigits = (s) => s.replace(/[٠-٩٫٬]/g, (d) => DIGITS[d]).replace(/،/g, ',').replace(/؛/g, ';').replace(/؟/g, '?');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function buildDictionary(raw) {
  const exact = new Map();
  for (const [k, v] of Object.entries(raw.exact || {})) if (v) exact.set(norm(k), v);
  const patterns = [];
  for (const [k, v] of Object.entries(raw.patterns || {})) {
    if (!v) continue;
    const parts = norm(k).split('{}');
    if (parts.length < 2 || parts.join('').replace(/\s/g, '').length < 2) continue;
    patterns.push({ re: new RegExp(`^${parts.map(escapeRe).join('(.+?)')}$`), out: v, weight: parts.join('').length });
  }
  // الأنماط الأطول (الأدق) أولاً
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, patterns };
}

/** يترجم قيمة واحدة (قد تكون جزءاً متغيّراً) — بلا تغيير إن لم تُعرف */
function translateValue(dict, value, depth = 0) {
  const key = norm(value);
  if (!key || !AR.test(key)) return null;
  const hit = dict.exact.get(key);
  if (hit) return hit;
  for (const p of dict.patterns) {
    const m = key.match(p.re);
    if (!m) continue;
    const vals = m.slice(1).map((g) => (depth < 2 ? translateValue(dict, g, depth + 1) : null) || dateOrNumber(g) || g);
    return p.out.replace(/\{(\d+)\}/g, (_, i) => vals[Number(i)] ?? '').replace(/\{\}/g, () => vals.shift() ?? '');
  }
  return dateOrNumber(key);
}

/** التواريخ والأرقام العربية: ١٧ نوفمبر ٢٠٢٦ ← 17 November 2026 */
function dateOrNumber(s) {
  const t = norm(s);
  const words = t.split(' ');
  const known = words.every((w) => /^[٠-٩0-9٫٬.,:/\-–—%+()]+$/.test(w) || MONTHS[w] || DAYS[w] || w === 'ص' || w === 'م' || w === 'هـ' || !AR.test(w));
  if (!known || !/[٠-٩]|[؀-ۿ]/.test(t)) return null;
  return latinDigits(words.map((w) => MONTHS[w] || DAYS[w] || (w === 'ص' ? 'AM' : w === 'م' ? 'PM' : w)).join(' '));
}

function translateTextNode(dict, node, memo) {
  const v = node.nodeValue;
  if (!v || memo.get(node) === v || !AR.test(v)) return;
  const out = translateValue(dict, v);
  if (out == null) return;
  const lead = v.match(/^\s*/)[0];
  const trail = v.match(/\s*$/)[0];
  const next = lead + out + trail;
  memo.set(node, next);
  if (next !== v) node.nodeValue = next;
}

function skipped(el) {
  // المجلة والمستندات العربية بطبيعتها لا تُترجم
  return !!el.closest?.('[data-no-translate],[contenteditable="true"],.notranslate,.mz-page,.mzv-page');
}

function translateTree(dict, root, memo) {
  if (!root) return;
  if (root.nodeType === 3) {
    const p = root.parentElement;
    if (p && !SKIP_TAGS.has(p.tagName) && !skipped(p)) translateTextNode(dict, root, memo);
    return;
  }
  if (root.nodeType !== 1 || SKIP_TAGS.has(root.tagName) || skipped(root)) return;
  translateAttrs(dict, root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) return SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-no-translate') || n.isContentEditable || n.classList?.contains('mz-page') || n.classList?.contains('mzv-page') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === 3) translateTextNode(dict, n, memo);
    else translateAttrs(dict, n);
    n = walker.nextNode();
  }
}

function translateAttrs(dict, el) {
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a);
    if (v && AR.test(v)) {
      const out = translateValue(dict, v);
      if (out != null && out !== v) el.setAttribute(a, out);
    }
  }
  // نصوص الخيارات والأزرار من نوع الإدخال
  if (el.tagName === 'INPUT' && ['button', 'submit'].includes(el.type) && AR.test(el.value)) {
    const out = translateValue(dict, el.value);
    if (out) el.value = out;
  }
}


module.exports = { AR, ATTRS, buildDictionary, translateValue, dateOrNumber, translateTree };
