// ======================================================================
// عارض المجلة
// ----------------------------------------------------------------------
// • نمط الكتاب: تقليب واقعي كالورق (page-flip — المكتبة نفسها في «توثيق»):
//   اسحب طرف الصفحة أو انقره، أو استعمل الأزرار وأسهم لوحة المفاتيح،
//   والاتجاه عربي (يُقلَّب من اليسار إلى اليمين).
// • نمط التمرير: الصفحات متتابعة — وهو الافتراضي على الجوال.
// • الطباعة: الصفحات بمقاسها تماماً (A4 أو مربعة ٢١٠×٢١٠)، واحدة في كل
//   ورقة. و«نسخة المطبعة» تضيف ٣ ملم نزفاً حول كل صفحة وعلامات القصّ.
// ======================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Rows3, ChevronRight, ChevronLeft, Printer, Link2, Check, Scissors } from 'lucide-react';
import { MAGAZINE_CSS } from './MagazinePages';
import { filterDefsMarkup } from '../../lib/documentation/photoLook';

const PAGE_PX = 793.7; // ٢١٠ ملم بدقة ٩٦ نقطة
const FILTER_DEFS = filterDefsMarkup();
const toAr = (n) => String(n ?? '').replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function ScaledPage({ node, width, ratio }) {
  const scale = width / PAGE_PX;
  return (
    <div className="mzv-page" style={{ width, height: width * ratio }}>
      <div className="mzv-page-inner" style={{ transform: `scale(${scale})` }}>{node}</div>
    </div>
  );
}

export default function MagazineViewer({ pages, shareUrl = null, title = '', allowPress = false, format = 'A4' }) {
  const square = format === 'SQUARE';
  const RATIO = square ? 1 : 297 / 210;
  const pageMm = square ? 210 : 297;
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: 1200, h: 800 });
  const [mode, setMode] = useState('book');
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

  // ── التقليب الواقعي ──
  // page-flip لا يدعم الاتجاه العربي، فتُمرَّر الصفحات معكوسة ويُبدأ من آخرها،
  // فيقع الغلاف يميناً وتُقلَّب الصفحات كالكتاب العربي. وتُنسخ الصفحات إلى
  // حاوية لا يديرها React حتى لا يتعارض نقل المكتبة لعناصرها مع React.
  const srcRef = useRef(null);
  const holderRef = useRef(null);
  const flipRef = useRef(null);
  const [flipIdx, setFlipIdx] = useState(0);
  const [flipCount, setFlipCount] = useState(0);
  const bookPages = useMemo(() => {
    // عدد زوجي حتى ينغلق الغلاف الخلفي وحده
    if (pages.length % 2 === 0) return pages;
    return [...pages.slice(0, -1), { key: 'blank', node: <section className="mz-page" />, blank: true }, pages[pages.length - 1]];
  }, [pages]);

  const scale = Math.min((box.w - 120) / (PAGE_PX * 2), (box.h - 20) / (PAGE_PX * RATIO));
  const fScale = Math.max(0.2, Math.min(scale, 1.4));

  useEffect(() => {
    if (effectiveMode !== 'book') return undefined;
    let cancelled = false;
    let pf = null;
    (async () => {
      const mod = await import('page-flip');
      const PageFlip = mod.PageFlip || mod.default?.PageFlip;
      const holder = holderRef.current;
      const src = srcRef.current;
      if (cancelled || !holder || !src) return;
      holder.innerHTML = '';
      const book = document.createElement('div');
      holder.appendChild(book);
      const clones = Array.from(src.querySelectorAll(':scope > .flip-page')).map((el) => el.cloneNode(true)).reverse();
      if (!clones.length) return;
      pf = new PageFlip(book, {
        width: Math.round(PAGE_PX),
        height: Math.round(PAGE_PX * RATIO),
        size: 'fixed',
        showCover: true,
        usePortrait: false,
        startPage: clones.length - 1,
        drawShadow: true,
        maxShadowOpacity: 0.45,
        flippingTime: 900,
        useMouseEvents: true,
        swipeDistance: 20,
        mobileScrollSupport: true,
      });
      pf.loadFromHTML(clones);
      if (cancelled) { try { pf.destroy(); } catch { /* فُكّك قبل اكتمال التهيئة */ } return; }
      flipRef.current = pf;
      const total = pf.getPageCount();
      setFlipCount(total);
      setFlipIdx(total - 1 - pf.getCurrentPageIndex());
      pf.on('flip', (e) => setFlipIdx(total - 1 - Number(e.data)));
    })().catch((e) => { console.error('[flipbook]', e); }); // eslint-disable-line no-console
    return () => {
      cancelled = true;
      flipRef.current = null;
      try { pf?.destroy(); } catch { /* أزالت React الحاوية قبل التدمير */ }
    };
  }, [effectiveMode, bookPages, RATIO]);

  // في الكتاب العربي: «التالي» قراءةً هو الرجوع في فهرس المكتبة المعكوس
  const go = (dir) => {
    const f = flipRef.current;
    if (!f) return;
    if (dir > 0) f.flipPrev(); else f.flipNext();
  };

  useEffect(() => {
    if (effectiveMode !== 'book') return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(1);
      if (e.key === 'ArrowRight') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [effectiveMode]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* المتصفح منع النسخ */ }
  };

  const print = (asPress) => {
    setPress(asPress);
    setTimeout(() => window.print(), 150);
  };

  const pageW = Math.min(box.w - 24, 820);
  const readingLabel = flipCount
    ? (flipIdx === 0 ? 'الغلاف' : flipIdx >= flipCount - 1 ? 'الغلاف الخلفي' : `الصفحتان ${toAr(flipIdx)}–${toAr(Math.min(flipIdx + 1, flipCount - 1))}`)
    : '';

  return (
    <div className={`mzv ${square ? 'mz-fmt-sq' : ''}`} ref={wrapRef}>
      <style>{MAGAZINE_CSS + VIEWER_CSS(press, pageMm)}</style>
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: FILTER_DEFS }} />

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
          <button type="button" className="mzv-nav mzv-nav-r" onClick={() => go(-1)} disabled={flipIdx <= 0} aria-label="الصفحة السابقة"><ChevronRight size={22} /></button>
          <div className="mzv-flip-box" style={{ width: PAGE_PX * 2 * fScale, height: PAGE_PX * RATIO * fScale }}>
            <div className="mzv-flip-scale" style={{ width: PAGE_PX * 2, height: PAGE_PX * RATIO, transform: `scale(${fScale})` }}>
              <div ref={holderRef} className="mzv-flip-holder" />
            </div>
          </div>
          <button type="button" className="mzv-nav mzv-nav-l" onClick={() => go(1)} disabled={flipCount > 0 && flipIdx >= flipCount - 1} aria-label="الصفحة التالية"><ChevronLeft size={22} /></button>
          <p className="mzv-count">{readingLabel}{flipCount ? ` · ${toAr(pages.length)} صفحة` : ''} — اسحب طرف الصفحة أو انقره للتقليب</p>
          {/* مصدر الصفحات للتقليب (تُنسخ منه، ولا يُعرض) */}
          <div ref={srcRef} className="mzv-flip-src" aria-hidden="true">
            {bookPages.map((p, k) => (
              <div key={p.key} className="flip-page" data-density={k === 0 || k === bookPages.length - 1 ? 'hard' : 'soft'} style={{ width: PAGE_PX, height: PAGE_PX * RATIO }}>
                {p.node}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mzv-scroll">
          {pages.map((p) => <ScaledPage key={p.key} node={p.node} width={pageW} ratio={RATIO} />)}
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

// نسخة المطبعة: الورقة = الصفحة + نزف ٣ ملم + هامش علامات ٥ ملم من كل جانب
// (٢٢٦×٣١٣ للـA4، و٢٢٦×٢٢٦ للمربعة). والصفحة تُكبَّر بنسبة واحدة فيمتدّ
// لونها وصورها في النزف، والمحتوى في مأمن داخل الحواف.
function VIEWER_CSS(press, pageH = 297) {
  const sheetW = press ? 226 : 210;
  const sheetH = press ? pageH + 16 : pageH;

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
.mzv-nav-r{right:14px}
.mzv-nav-l{left:14px}
.mzv-flip-box{position:relative;filter:drop-shadow(0 30px 40px rgba(11,63,66,.35))}
.mzv-flip-scale{position:absolute;top:0;left:0;transform-origin:top left;direction:ltr}
.mzv-flip-holder{width:100%;height:100%}
.mzv-flip-holder .flip-page{overflow:hidden;background:#fcfaf5}
.mzv-flip-src{position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;direction:ltr}
.mzv-nav:disabled{opacity:.35;cursor:default}
.mzv-count{font:700 13px Cairo,sans-serif;color:#5E6F70;margin:12px 0 0;direction:rtl}
.mzv-turn-next{animation:mzvNext .55s cubic-bezier(.2,.7,.2,1)}
.mzv-turn-prev{animation:mzvPrev .55s cubic-bezier(.2,.7,.2,1)}
@keyframes mzvNext{from{opacity:.2;transform:rotateY(-14deg) translateX(-30px)}to{opacity:1;transform:none}}
@keyframes mzvPrev{from{opacity:.2;transform:rotateY(14deg) translateX(30px)}to{opacity:1;transform:none}}
.mzv-scroll{display:flex;flex-direction:column;align-items:center;gap:16px;padding:16px 12px 40px}
.mzv-scroll .mzv-page{box-shadow:0 18px 40px -24px rgba(11,63,66,.5)}
.mzv-page{position:relative;overflow:hidden;background:#fff;flex:none}
.mzv-page-inner{position:absolute;top:0;left:0;width:210mm;height:${pageH}mm;transform-origin:top left}
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
  .mzv-sheet-page{position:absolute;top:${press ? 5 : 0}mm;left:${press ? 5 : 0}mm;width:210mm;height:${pageH}mm;transform-origin:top left;${press ? 'transform:scale(1.02857);' : ''}}
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
