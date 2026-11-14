// ======================================================================
// محرّر صورة التوثيق — بلا مساس بالأصل
// ----------------------------------------------------------------------
// انقر على الوجوه (أو أهم ما في الصورة) فيبقى ظاهراً في كل إطار تُقصّ
// عليه في المجلة: عريض أو مربع أو طولي. والفلاتر والتقريب أرقام تُطبَّق
// عند العرض، فلا تنقص جودة الصورة شيئاً، ويُرجَع عنها بنقرة.
// ======================================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, RotateCcw, RotateCw, Wand2, Star, Undo2, Check, SlidersHorizontal, Crosshair, ListOrdered } from 'lucide-react';
import api from '../../lib/axios';
import { FILTERS, DEFAULT_FOCUS, lookOf, imgStyle, cssFilter, filterDefsMarkup, autoEnhance } from '../../lib/documentation/photoLook';
import { rotateDocumentationPhoto, imageLightStats } from '../../lib/clientImage';

const FRAMES = [
  { key: 'wide', label: 'عريض', ratio: '16 / 10' },
  { key: 'square', label: 'مربع', ratio: '1 / 1' },
  { key: 'tall', label: 'طولي', ratio: '3 / 4' },
];

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
  const [caption, setCaption] = useState(media.caption || '');
  const [cover, setCover] = useState(!!isCover);
  const [session, setSession] = useState(sessionIndex);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState({ full: media.fullUrl, thumb: media.thumbUrl, w: media.width, h: media.height });
  const boxRef = useRef(null);
  const dragging = useRef(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch) => setLook((l) => ({ ...l, ...patch }));
  const defs = useMemo(() => filterDefsMarkup(), []);

  // موضع التركيز من موضع النقر على الصورة كاملة
  const focusFrom = (e) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    set({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
  };

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
      // بعد التدوير يتبدّل المحوران فيعود التركيز إلى موضعه الافتراضي
      set({ ...DEFAULT_FOCUS });
    } catch (e) {
      toast.error(e.response?.data?.message || 'تعذّر تدوير الصورة');
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    try {
      const pristine = look.filter === 'none' && look.zoom === 1 && look.b === 1 && look.c === 1 && look.s === 1
        && look.x === DEFAULT_FOCUS.x && look.y === DEFAULT_FOCUS.y;
      await api.patch(`/documentation/media/${media.id}`, {
        edit: pristine ? null : look,
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

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-[#0b2224]/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="تعديل الصورة">
      <div aria-hidden="true" dangerouslySetInnerHTML={{ __html: defs }} />
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden bg-white sm:rounded-[22px] sm:shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <p className="flex-1 text-[15px] font-extrabold text-text-main">تعديل الصورة</p>
          <span className="hidden text-[11.5px] text-text-soft sm:inline">الأصل محفوظ كما هو — كل تعديل يُرجَع عنه بنقرة</span>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="grid h-9 w-9 place-items-center rounded-full text-text-soft hover:bg-background"><X size={18} /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── الصورة كاملة وموضع التركيز ── */}
          <div className="flex flex-col gap-3 bg-[#f4f1ea] p-4">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-primary">
              <Crosshair size={15} aria-hidden="true" /> انقر على الوجوه أو أهم ما في الصورة — يبقى ظاهراً في كل إطار
            </p>
            <div className="flex flex-1 items-center justify-center">
              <div ref={boxRef}
                className="relative max-h-[52vh] w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl shadow-[0_10px_30px_-18px_rgba(0,0,0,.6)]"
                style={{ aspectRatio: `${ratio}`, maxWidth: `calc(52vh * ${ratio})` }}
                onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); focusFrom(e); }}
                onPointerMove={(e) => { if (dragging.current) focusFrom(e); }}
                onPointerUp={() => { dragging.current = false; }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src.full} alt={caption || 'الصورة'} draggable={false} className="h-full w-full object-contain" style={{ filter: filterCss }} />
                <span className="pointer-events-none absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-white shadow-[0_0_0_2px_#C6AA76,0_4px_14px_rgba(0,0,0,.45)]"
                  style={{ left: `${look.x * 100}%`, top: `${look.y * 100}%` }}>
                  <span className="h-2 w-2 rounded-full bg-[#C6AA76]" />
                </span>
              </div>
            </div>
            {/* كيف تظهر في إطارات المجلة */}
            <div className="grid grid-cols-3 gap-3">
              {FRAMES.map((f) => (
                <div key={f.key} className="text-center">
                  <div className="mx-auto max-w-full overflow-hidden rounded-lg bg-white shadow-sm" style={{ aspectRatio: f.ratio, height: 92 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src.thumb} alt="" className="h-full w-full" style={imgStyle(look)} />
                  </div>
                  <span className="mt-1 block text-[11px] font-bold text-text-soft">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── الأدوات ── */}
          <div className="space-y-4 p-4">
            <div>
              <p className="mb-2 text-xs font-extrabold text-text-main">الفلتر <span className="font-normal text-text-soft">— لا يُنقص الجودة</span></p>
              <div className="grid grid-cols-4 gap-2">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" onClick={() => set({ filter: f.id })} title={f.hint || f.label} aria-pressed={look.filter === f.id}
                    className={`overflow-hidden rounded-xl border-2 text-center transition ${look.filter === f.id ? 'border-accent' : 'border-transparent hover:border-border'}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src.thumb} alt="" className="aspect-square w-full object-cover" style={{ objectPosition: `${look.x * 100}% ${look.y * 100}%`, filter: cssFilter({ ...look, filter: f.id }) }} />
                    <span className="block py-1 text-[10.5px] font-bold text-text-main">{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={autoFix} className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-2 text-[12.5px] font-bold text-primary hover:brightness-95">
                <Wand2 size={15} aria-hidden="true" /> تحسين تلقائي
              </button>
              <button type="button" onClick={() => rotate(-1)} disabled={busy} aria-label="تدوير عكس عقارب الساعة" title="تدوير" className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-main hover:bg-background disabled:opacity-50"><RotateCcw size={15} /></button>
              <button type="button" onClick={() => rotate(1)} disabled={busy} aria-label="تدوير مع عقارب الساعة" title="تدوير" className="grid h-9 w-9 place-items-center rounded-full border border-border text-text-main hover:bg-background disabled:opacity-50"><RotateCw size={15} /></button>
              <button type="button" onClick={() => setManual((v) => !v)} aria-expanded={manual} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-text-soft hover:bg-background">
                <SlidersHorizontal size={15} aria-hidden="true" /> يدوي
              </button>
            </div>

            <Slider label="تقريب" value={look.zoom} min={1} max={2.5} step={0.05} onChange={(v) => set({ zoom: v })} />
            {manual && (
              <div className="space-y-3 rounded-2xl bg-background p-3">
                <Slider label="الإضاءة" value={look.b} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ b: v })} />
                <Slider label="التباين" value={look.c} min={0.7} max={1.4} step={0.01} onChange={(v) => set({ c: v })} />
                <Slider label="تشبّع الألوان" value={look.s} min={0} max={1.6} step={0.01} onChange={(v) => set({ s: v })} />
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-extrabold text-text-main">تعليق الصورة</span>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} placeholder="مثال: جانب من التطبيق العملي في اليوم الثالث"
                className="w-full rounded-xl border border-border px-3 py-2 text-[13px] outline-none focus:border-primary" />
            </label>

            {sessions.length > 0 && (
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-extrabold text-text-main"><ListOrdered size={14} aria-hidden="true" /> صورة لجلسة</span>
                <select value={session} onChange={(e) => setSession(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-white px-3 py-2 text-[13px] outline-none focus:border-primary">
                  <option value={-1}>— صورة عامة في المعرض —</option>
                  {sessions.map((s, i) => <option key={i} value={i}>{i + 1}. {s.title || 'جلسة بلا عنوان'}</option>)}
                </select>
              </label>
            )}

            <button type="button" onClick={() => setCover((v) => !v)} disabled={isCover} aria-pressed={cover}
              className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-[13px] font-bold ${cover ? 'border-accent bg-sand/15 text-warning' : 'border-border text-text-main hover:bg-background'}`}>
              <Star size={16} aria-hidden="true" fill={cover ? 'currentColor' : 'none'} /> {isCover ? 'هذه صورة الغلاف' : cover ? 'ستكون صورة الغلاف' : 'اجعلها صورة الغلاف'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3">
          <button type="button" onClick={() => setLook(lookOf(null))} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-bold text-text-soft hover:bg-white">
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
    </div>
  );
}
