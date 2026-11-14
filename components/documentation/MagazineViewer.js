// ======================================================================
// عارض المجلة
// ----------------------------------------------------------------------
// • نمط الكتاب: صفحتان متقابلتان تُقلَّبان (من اليمين إلى اليسار)، بالأزرار
//   أو بأسهم لوحة المفاتيح.
// • نمط التمرير: الصفحات متتابعة — وهو الافتراضي على الجوال.
// • الطباعة: الصفحات بمقاسها A4 تماماً، واحدة في كل ورقة. و«نسخة المطبعة»
//   تضيف ٣ ملم نزفاً حول كل صفحة وعلامات القصّ لإدارة المطابع.
// ======================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Rows3, ChevronRight, ChevronLeft, Printer, Link2, Check, Scissors } from 'lucide-react';
import { MAGAZINE_CSS } from './MagazinePages';

const PAGE_PX = 793.7; // ٢١٠ ملم بدقة ٩٦ نقطة
const RATIO = 297 / 210;
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function ScaledPage({ node, width }) {
  const scale = width / PAGE_PX;
  return (
    <div className="mzv-page" style={{ width, height: width * RATIO }}>
      <div className="mzv-page-inner" style={{ transform: `scale(${scale})` }}>{node}</div>
    </div>
  );
}

export default function MagazineViewer({ pages, shareUrl = null, title = '', allowPress = false }) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 1200, h: 800 });
  const [mode, setMode] = useState('book');
  const [spread, setSpread] = useState(0);
  const [anim, setAnim] = useState('');
  const [copied, setCopied] = useState(false);
  const [press, setPress] = useState(false);

  // مقاس منطقة العرض
  useEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      setBox({ w: el ? el.clientWidth : window.innerWidth, h: window.innerHeight - 150 });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const narrow = box.w < 900;
  const effectiveMode = narrow ? 'scroll' : mode;

  // صفحات الكتاب: الغلاف وحده، ثم كل صفحتين متقابلتين، والأخيرة وحدها إن بقيت
  const spreads = useMemo(() => {
    const out = [[0]];
    for (let i = 1; i < pages.length; i += 2) out.push(i + 1 < pages.length ? [i, i + 1] : [i]);
    return out;
  }, [pages.length]);

  const go = useCallback((dir) => {
    setSpread((s) => {
      const next = Math.max(0, Math.min(spreads.length - 1, s + dir));
      if (next !== s) setAnim(dir > 0 ? 'mzv-turn-next' : 'mzv-turn-prev');
      return next;
    });
  }, [spreads.length]);

  useEffect(() => {
    if (effectiveMode !== 'book') return undefined;
    const onKey = (e) => {
      // في كتاب عربي: اليسار هو التالي
      if (e.key === 'ArrowLeft') go(1);
      if (e.key === 'ArrowRight') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveMode, go]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* المتصفح منع النسخ */ }
  };

  const print = (asPress) => {
    setPress(asPress);
    setTimeout(() => window.print(), 150);
  };

  const pageW = effectiveMode === 'book'
    ? Math.min((box.w - 40) / 2, box.h / RATIO)
    : Math.min(box.w - 24, 820);
  const current = spreads[spread] || [0];

  return (
    <div className="mzv" ref={wrapRef}>
      <style>{MAGAZINE_CSS + VIEWER_CSS(press)}</style>

      {/* ── شريط الأدوات ── */}
      <div className="mzv-bar">
        <span className="mzv-title">{title}</span>
        {!narrow && (
          <div className="mzv-seg" role="group" aria-label="طريقة العرض">
            <button type="button" aria-pressed={mode === 'book'} onClick={() => setMode('book')}><BookOpen size={15} aria-hidden="true" /> تصفّح</button>
            <button type="button" aria-pressed={mode === 'scroll'} onClick={() => setMode('scroll')}><Rows3 size={15} aria-hidden="true" /> متتابع</button>
          </div>
        )}
        {shareUrl && (
          <button type="button" className="mzv-btn" onClick={copy}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />} {copied ? 'نُسخ الرابط' : 'نسخ الرابط'}
          </button>
        )}
        <button type="button" className="mzv-btn mzv-btn-pri" onClick={() => print(false)}>
          <Printer size={15} aria-hidden="true" /> طباعة / حفظ PDF
        </button>
        {allowPress && (
          <button type="button" className="mzv-btn" onClick={() => print(true)} title="نسخة بنزف ٣ ملم وعلامات قصّ لإدارة المطابع">
            <Scissors size={15} aria-hidden="true" /> نسخة المطبعة
          </button>
        )}
      </div>

      {/* ── العرض ── */}
      {effectiveMode === 'book' ? (
        <div className="mzv-book">
          <button type="button" className="mzv-nav" onClick={() => go(-1)} disabled={spread === 0} aria-label="الصفحة السابقة"><ChevronLeft size={22} /></button>
          <div key={spread} className={`mzv-spread ${anim}`} onAnimationEnd={() => setAnim('')}>
            {current.map((i) => <ScaledPage key={pages[i].key} node={pages[i].node} width={pageW} />)}
          </div>
          <button type="button" className="mzv-nav" onClick={() => go(1)} disabled={spread === spreads.length - 1} aria-label="الصفحة التالية"><ChevronRight size={22} /></button>
          <p className="mzv-count">
            {current.length === 2 ? `الصفحتان ${toAr(current[0] + 1)}–${toAr(current[1] + 1)}` : `الصفحة ${toAr(current[0] + 1)}`} من {toAr(pages.length)}
          </p>
        </div>
      ) : (
        <div className="mzv-scroll">
          {pages.map((p) => <ScaledPage key={p.key} node={p.node} width={pageW} />)}
        </div>
      )}

      {/* ── نسخة الطباعة: كل صفحة بمقاسها في ورقة ── */}
      <div className="mzv-print" aria-hidden="true">
        {pages.map((p) => (
          <div key={p.key} className="mzv-sheet">
            {press && <><i className="mzv-crop tl" /><i className="mzv-crop tr" /><i className="mzv-crop bl" /><i className="mzv-crop br" /></>}
            <div className="mzv-sheet-page">{p.node}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// نسخة المطبعة: الورقة ٢٢٦×٣١٣ ملم = الصفحة ٢١٠×٢٩٧ + نزف ٣ ملم + هامش علامات ٥ ملم.
// والصفحة تُكبَّر إلى ٢١٦×٣٠٣ فيمتدّ لونها وصورها في النزف، والمحتوى في مأمن داخل الحواف.
function VIEWER_CSS(press) {
  const sheetW = press ? 226 : 210;
  const sheetH = press ? 313 : 297;
  return `
.mzv{min-height:100vh;background:#e9ece9}
.mzv-bar{position:sticky;top:0;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 16px;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);border-bottom:1px solid #E3E7E7;font-family:Cairo,sans-serif;direction:rtl}
.mzv-title{font-weight:800;color:#1C2E30;font-size:14px;margin-inline-end:auto;max-width:50%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mzv-seg{display:inline-flex;background:#F2F4F4;border-radius:999px;padding:3px}
.mzv-seg button{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;border-radius:999px;padding:6px 12px;font:700 13px Cairo,sans-serif;color:#5E6F70;cursor:pointer}
.mzv-seg button[aria-pressed="true"]{background:#fff;color:#2E6066;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mzv-btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:8px 14px;font:700 13px Cairo,sans-serif;color:#5E6F70;background:transparent;cursor:pointer}
.mzv-btn:hover{background:#F2F4F4;color:#2E6066}
.mzv-btn-pri{background:#2E6066;color:#fff;box-shadow:0 8px 18px -10px rgba(46,96,102,.85)}
.mzv-btn-pri:hover{background:#244E53;color:#fff}
.mzv-book{display:flex;flex-direction:column;align-items:center;padding:18px 20px 30px;position:relative}
.mzv-spread{display:flex;direction:rtl;box-shadow:0 30px 60px -30px rgba(11,63,66,.55);perspective:2000px}
.mzv-spread .mzv-page+.mzv-page{box-shadow:inset 18px 0 22px -18px rgba(0,0,0,.25)}
.mzv-nav{position:absolute;top:45%;width:46px;height:46px;border-radius:50%;border:0;background:#fff;color:#2E6066;box-shadow:0 6px 18px -6px rgba(0,0,0,.25);cursor:pointer;display:grid;place-items:center;z-index:5}
.mzv-nav:first-of-type{right:14px}
.mzv-nav:last-of-type{left:14px}
.mzv-nav:disabled{opacity:.35;cursor:default}
.mzv-count{font:700 13px Cairo,sans-serif;color:#5E6F70;margin:12px 0 0;direction:rtl}
.mzv-turn-next{animation:mzvNext .55s cubic-bezier(.2,.7,.2,1)}
.mzv-turn-prev{animation:mzvPrev .55s cubic-bezier(.2,.7,.2,1)}
@keyframes mzvNext{from{opacity:.2;transform:rotateY(-14deg) translateX(-30px)}to{opacity:1;transform:none}}
@keyframes mzvPrev{from{opacity:.2;transform:rotateY(14deg) translateX(30px)}to{opacity:1;transform:none}}
.mzv-scroll{display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px 12px 40px}
.mzv-scroll .mzv-page{box-shadow:0 18px 40px -24px rgba(11,63,66,.5)}
.mzv-page{position:relative;overflow:hidden;background:#fff;flex:none}
.mzv-page-inner{position:absolute;top:0;left:0;width:210mm;height:297mm;transform-origin:top left}
.mzv-print{display:none}
@media (prefers-reduced-motion:reduce){.mzv-turn-next,.mzv-turn-prev{animation:none}}
@media print{
  @page{size:${sheetW}mm ${sheetH}mm;margin:0}
  html,body{background:#fff!important}
  body *{visibility:hidden}
  .mzv-print,.mzv-print *{visibility:visible}
  .mzv-print{display:block;position:absolute;top:0;left:0}
  .mzv-bar,.mzv-book,.mzv-scroll{display:none!important}
  .mzv-sheet{width:${sheetW}mm;height:${sheetH}mm;position:relative;overflow:hidden;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}
  .mzv-sheet:last-child{break-after:auto;page-break-after:auto}
  .mzv-sheet-page{position:absolute;top:${press ? 5 : 0}mm;left:${press ? 5 : 0}mm;width:210mm;height:297mm;transform-origin:top left;${press ? 'transform:scale(1.02857);' : ''}}
  .mzv-crop{position:absolute;background:#000;visibility:visible}
  .mzv-crop.tl,.mzv-crop.tr,.mzv-crop.bl,.mzv-crop.br{width:0;height:0}
  .mzv-crop:before,.mzv-crop:after{content:"";position:absolute;background:#000}
  .mzv-crop:before{width:4mm;height:0.15mm}
  .mzv-crop:after{width:0.15mm;height:4mm}
  .mzv-crop.tl{top:8mm;left:8mm}.mzv-crop.tl:before{left:-8mm;top:0}.mzv-crop.tl:after{top:-8mm;left:0}
  .mzv-crop.tr{top:8mm;right:8mm}.mzv-crop.tr:before{right:-8mm;top:0}.mzv-crop.tr:after{top:-8mm;right:0}
  .mzv-crop.bl{bottom:8mm;left:8mm}.mzv-crop.bl:before{left:-8mm;bottom:0}.mzv-crop.bl:after{bottom:-8mm;left:0}
  .mzv-crop.br{bottom:8mm;right:8mm}.mzv-crop.br:before{right:-8mm;bottom:0}.mzv-crop.br:after{bottom:-8mm;right:0}
}
`;
}
