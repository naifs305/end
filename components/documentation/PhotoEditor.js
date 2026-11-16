// ======================================================================
// محرّر صورة التوثيق — بلا مساس بالأصل
// ----------------------------------------------------------------------
// قصّ حرّ أو بمقاس جاهز (اسحب الإطار لتحريكه، وزواياه لتغيير حجمه)،
// أو «الصورة كاملة» بلا قصّ. والفلاتر والإضاءة أرقام تُطبَّق عند العرض،
// فلا تنقص جودة الصورة شيئاً، ويُرجَع عنها بنقرة.
// يُفتح فوق الصفحة كلها (Portal) أينما كان موضع الصورة في الصفحة.
// ======================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { X, RotateCcw, RotateCw, Wand2, Star, Undo2, Check, SlidersHorizontal, Maximize, Crop, ListOrdered } from 'lucide-react';
import api from '../../lib/axios';
import { FILTERS, FULL, lookOf, isPristine, cssFilter, filterDefsMarkup, autoEnhance } from '../../lib/documentation/photoLook';
import { rotateDocumentationPhoto, imageLightStats } from '../../lib/clientImage';
import PhotoImg from './PhotoImg';

// مقاسات القصّ: «الأصل» بلا قصّ، و«حر» بلا نسبة ثابتة
const RATIOS = [
  { key: 'full', label: 'الأصل', r: null },
  { key: 'free', label: 'حر', r: 0 },
  { key: '1:1', label: 'مربع', r: 1 },
  { key: '4:3', label: 'عرضي ٤:٣', r: 4 / 3 },
  { key: '3:4', label: 'طولي ٣:٤', r: 3 / 4 },
  { key: '16:9', label: 'عريض ١٦:٩', r: 16 / 9 },
  { key: '9:16', label: 'جوال ٩:١٦', r: 9 / 16 },
];
const MIN = 0.08;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// أكبر جزء بالنسبة المطلوبة، في الوسط أفقياً والثلث الأعلى رأسياً (حيث الوجوه غالباً)
function fitRatio(r, W, H) {
  const imgR = W / H;
  let w = 1; let h = 1;
  if (r > imgR) h = imgR / r; else w = r / imgR;
  return { x: (1 - w) / 2, y: (1 - h) * 0.3, w, h };
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[11.5px] font-bold text-text-soft">
        <span>{label}</span><span dir="ltr">{Math.round(value * 100)}٪</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00676a]" />
    </label>
  );
}

export default function PhotoEditor({ media, isCover, sessions = [], sessionIndex = -1, onClose, onSaved }) {
  const [look, setLook] = useState(() => lookOf(media.edit));
  const [ratioKey, setRatioKey] = useState(() => {
    const c = lookOf(media.edit).crop;
    return c.w === 1 && c.h === 1 && c.x === 0 && c.y === 0 ? 'full' : 'free';
  });
  const [caption, setCaption] = useState(media.caption || '');
  const [cover, setCover] = useState(!!isCover);
  const [session, setSession] = useState(sessionIndex);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState({ full: media.fullUrl, thumb: media.thumbUrl, w: media.width, h: media.height });
  const stageRef = useRef(null);
  const drag = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const set = (patch) => setLook((l) => ({ ...l, ...patch }));
  const defs = useMemo(() => filterDefsMarkup(), []);
  const ratioDef = RATIOS.find((x) => x.key === ratioKey) || RATIOS[0];
  const crop = look.crop;

  const chooseRatio = (key) => {
    setRatioKey(key);
    const def = RATIOS.find((x) => x.key === key);
    if (def.r === null) set({ crop: { ...FULL } });
    else if (def.r > 0) set({ crop: fitRatio(def.r, src.w, src.h), fit: 'cover' });
    else if (crop.w === 1 && crop.h === 1) set({ crop: { x: 0.08, y: 0.06, w: 0.84, h: 0.84 }, fit: 'cover' });
  };

  // ── السحب: تحريك الإطار أو تغيير حجمه من زواياه ──
  const pointer = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
  };
  const startDrag = (e, mode) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, start: pointer(e), crop: { ...crop } };
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const { px, py } = pointer(e);
    const dx = px - d.start.px; const dy = py - d.start.py;
    const c = d.crop;
    if (d.mode === 'move') {
      set({ crop: { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) } });
      return;
    }
    // الزاوية المسحوبة تتحرك، والمقابلة لها ثابتة
    const left = d.mode.includes('l'); const top = d.mode.includes('t');
    const ax = left ? c.x + c.w : c.x; const ay = top ? c.y + c.h : c.y;
    let w = clamp(left ? ax - (c.x + dx) : c.x + c.w + dx - ax, MIN, left ? ax : 1 - ax);
    let h = clamp(top ? ay - (c.y + dy) : c.y + c.h + dy - ay, MIN, top ? ay : 1 - ay);
    if (ratioDef.r) {
      // نسبة ثابتة: الارتفاع يتبع العرض (بنسب الصورة الفعلية)
      const k = (src.w / src.h) / ratioDef.r;
      h = w * k;
      const maxH = top ? ay : 1 - ay;
      if (h > maxH) { h = maxH; w = h / k; }
    }
    set({ crop: { x: left ? ax - w : ax, y: top ? ay - h : ay, w, h } });
  };
  const endDrag = () => { drag.current = null; };

  const autoFix = async () => {
    try {
      const stats = await imageLightStats(src.thumb);
      set({ ...autoEnhance(stats), filter: look.filter === 'none' ? 'clear' : look.filter });
      toast.success('حُسّنت الإضاءة والتباين');
    } catch { toast.error('تعذّر التحسين التلقائي'); }
  };

  const rotate = async (dir) => {
    setBusy(true);
    try {
      const out = await rotateDocumentationPhoto(src.full, dir);
      await api.patch(`/documentation/media/${media.id}`, { replace: out });
      setSrc({ full: out.full, thumb: out.thumb, w: out.width, h: out.height });
      set({ crop: { ...FULL } });
      setRatioKey('full');
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر تدوير الصورة');
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.patch(`/documentation/media/${media.id}`, {
        edit: isPristine(look) ? null : look,
        caption,
        ...(cover && !isCover ? { cover: true } : {}),
      });
      onSaved({ sessionIndex: session, changedSession: session !== sessionIndex });
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر الحفظ');
      setBusy(false);
    }
  };

  const ratio = (src.w || 4) / (src.h || 3);
  const filterCss = cssFilter(look);
  const preview = { ...media, width: src.w, height: src.h, fullUrl: src.thumb, edit: look };
  const cropping = ratioKey !== 'full';

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-stretch justify-center bg-[#0b2224]/75 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="تعديل الصورة" dir="rtl">
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: defs }} />
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden bg-white sm:max-h-[94vh] sm:rounded-[22px] sm:shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="flex-1 text-[15px] font-extrabold text-text-main">تعديل الصورة</p>
          <span className="hidden text-[11.5px] text-text-soft sm:inline">الأصل محفوظ كما هو — أي تعديل يُرجَع عنه بزر «الأصل»</span>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full text-text-soft hover:bg-background"><X size={18} /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          {/* ── منطقة القصّ ── */}
          <div className="flex min-h-0 flex-col gap-3 bg-[#1d2a2b] p-4">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="مقاس القصّ">
              {RATIOS.map((x) => (
                <button key={x.key} type="button" role="radio" aria-checked={ratioKey === x.key} onClick={() => chooseRatio(x.key)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${ratioKey === x.key ? 'bg-[#C6AA76] text-[#1d2a2b]' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}>
                  {x.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div ref={stageRef} className="relative w-full touch-none select-none"
                style={{ aspectRatio: `${ratio}`, maxWidth: `min(100%, calc(60vh * ${ratio}))` }}
                onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src.full} alt={caption || 'الصورة'} draggable={false} className="absolute inset-0 h-full w-full" style={{ filter: filterCss }} />
                {cropping && (
                  <div className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(10,20,21,.62)]"
                    style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
                    onPointerDown={(e) => startDrag(e, 'move')}>
                    {/* خطوط الأثلاث تعين على وضع الوجوه */}
                    <span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/25" />)}
                    </span>
                    {['tl', 'tr', 'bl', 'br'].map((h) => (
                      <span key={h} onPointerDown={(e) => startDrag(e, h)} role="presentation"
                        className={`absolute h-6 w-6 rounded-full border-[3px] border-white bg-[#C6AA76] shadow ${h.includes('t') ? '-top-3' : '-bottom-3'} ${h.includes('l') ? '-left-3' : '-right-3'}`}
                        style={{ cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize' }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="text-center text-[12px] text-white/70">
              {cropping ? 'اسحب الإطار لتحريكه، واسحب زواياه الذهبية لتكبيره أو تصغيره' : 'اختر مقاساً للقصّ، أو اترك الصورة بأصلها'}
            </p>
          </div>

          {/* ── الأدوات ── */}
          <div className="space-y-4 p-4 lg:overflow-y-auto">
            <button type="button" onClick={() => set({ fit: look.fit === 'contain' ? 'cover' : 'contain' })} aria-pressed={look.fit === 'contain'}
              className={`flex w-full items-start gap-2.5 rounded-2xl border p-3 text-start ${look.fit === 'contain' ? 'border-primary bg-primary-light/50' : 'border-border hover:bg-background'}`}>
              <Maximize size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
              <span>
                <span className="block text-[13px] font-extrabold text-text-main">الصورة كاملة في المجلة {look.fit === 'contain' ? '✓' : ''}</span>
                <span className="block text-[11.5px] text-text-soft">لا يُقصّ منها شيء أبداً، وتُملأ أطراف الإطار بخلفية من الصورة نفسها</span>
              </span>
            </button>

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-text-main"><Crop size={14} aria-hidden="true" /> هكذا تظهر في المجلة</p>
              <div className="grid grid-cols-3 items-end gap-2">
                {[{ l: 'إطار عريض', r: '16 / 10' }, { l: 'إطار مربع', r: '1 / 1' }, { l: 'إطار طولي', r: '3 / 4' }].map((f) => (
                  <div key={f.l} className="text-center">
                    <div className="relative mx-auto w-full overflow-hidden rounded-lg bg-background" style={{ aspectRatio: f.r }}>
                      <PhotoImg m={preview} />
                    </div>
                    <span className="mt-1 block text-[10.5px] font-bold text-text-soft">{f.l}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-extrabold text-text-main">الفلتر <span className="font-normal text-text-soft">— لا يُنقص الجودة</span></p>
              <div className="grid grid-cols-4 gap-2">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" onClick={() => set({ filter: f.id })} title={f.hint || f.label} aria-pressed={look.filter === f.id}
                    className={`overflow-hidden rounded-xl border-2 text-center transition ${look.filter === f.id ? 'border-accent' : 'border-transparent hover:border-border'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src.thumb} alt="" className="aspect-square w-full object-cover" style={{ filter: cssFilter({ ...look, filter: f.id }) }} />
                    <span className="block py-1 text-[10.5px] font-bold text-text-main">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={autoFix} className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-2 text-[12.5px] font-bold text-primary hover:brightness-95">
                <Wand2 size={15} aria-hidden="true" /> تحسين تلقائي
              </button>
              <button type="button" onClick={() => rotate(-1)} disabled={busy} title="تدوير يساراً" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-2 text-[12px] font-bold text-text-main hover:bg-background disabled:opacity-50"><RotateCcw size={14} aria-hidden="true" /> تدوير</button>
              <button type="button" onClick={() => rotate(1)} disabled={busy} aria-label="تدوير يميناً" title="تدوير يميناً" className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-main hover:bg-background disabled:opacity-50"><RotateCw size={14} /></button>
              <button type="button" onClick={() => setManual((v) => !v)} aria-expanded={manual} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-text-soft hover:bg-background">
                <SlidersHorizontal size={15} aria-hidden="true" /> إضاءة يدوية
              </button>
            </div>
            {manual && (
              <div className="space-y-3 rounded-2xl bg-background p-3">
                <Slider label="الإضاءة" value={look.b} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ b: v })} />
                <Slider label="التباين" value={look.c} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ c: v })} />
                <Slider label="تشبّع الألوان" value={look.s} min={0} max={1.6} step={0.01} onChange={(v) => set({ s: v })} />
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-text-main">تعليق تحت الصورة <span className="font-normal text-text-soft">— اختياري</span></span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="مثال: جانب من التطبيق العملي في اليوم الثالث"
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </label>

            {sessions.length > 0 && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-text-main"><ListOrdered size={14} aria-hidden="true" /> هذه الصورة من جلسة</span>
                <select value={session} onChange={(e) => setSession(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary">
                  <option value={-1}>— صورة عامة (تظهر في المعرض) —</option>
                  {sessions.map((s, i) => <option key={i} value={i}>{i + 1}. {s.title || 'جلسة بلا عنوان'}</option>)}
                </select>
              </label>
            )}

            <button type="button" onClick={() => setCover((v) => !v)} disabled={isCover} aria-pressed={cover}
              className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-[13px] font-bold ${cover ? 'border-accent bg-sand/15 text-warning' : 'border-border text-text-main hover:bg-background'}`}>
              <Star size={16} aria-hidden="true" fill={cover ? 'currentColor' : 'none'} /> {isCover ? 'هذه صورة غلاف المجلة' : cover ? 'ستصبح صورة غلاف المجلة' : 'اجعلها صورة غلاف المجلة'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3">
          <button type="button" onClick={() => { setLook(lookOf(null)); setRatioKey('full'); }} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-text-soft hover:bg-white">
            <Undo2 size={15} aria-hidden="true" /> الأصل
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-[13px] font-bold text-text-soft hover:bg-white">إلغاء</button>
          <button type="button" onClick={save} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_rgba(46,96,102,0.85)] hover:bg-primary-dark disabled:opacity-60">
            <Check size={15} aria-hidden="true" /> {busy ? 'جارٍ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
