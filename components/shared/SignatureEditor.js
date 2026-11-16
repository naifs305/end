// ======================================================================
// محرّر التوقيع الإلكتروني
// ----------------------------------------------------------------------
// صورة التوقيع غالباً لقطة جوال لورقة: خلفية رمادية، وهوامش واسعة،
// وحبر باهت. فقبل الحفظ: يُقص التوقيع، وتُزال الخلفية فيصير شفافاً،
// ويُوحَّد لون الحبر، ويُحفظ بمقاس ثابت — فيظهر في الشهادة نظيفاً
// بلا مربع أبيض فوق المطبوعة، وبحجم مضبوط في خانته.
// ======================================================================
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Crop, Wand2, RotateCw, Check, Eraser } from 'lucide-react';
import { normalizeImageFile } from '../../lib/clientImage';

const WORK_MAX = 1600;  // أطول ضلع لصورة العمل
const OUT_MAX_W = 600;  // مقاس الحفظ
const OUT_MAX_H = 240;
const VIEW_W = 560;     // عرض منطقة التحرير على الشاشة

const INKS = [
  { key: 'original', label: 'لون الأصل', color: null },
  { key: 'navy', label: 'أزرق', color: [16, 42, 110] },
  { key: 'black', label: 'أسود', color: [17, 17, 17] },
];

// إضاءة البكسل (٠ داكن – ٢٥٥ فاتح)
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// إضاءة الورق: وسيط إضاءة الصورة — فالحبر قليل والورق غالب
function paperLuminance(data) {
  const hist = new Array(256).fill(0);
  let n = 0;
  for (let i = 0; i < data.length; i += 16) { hist[Math.round(lum(data[i], data[i + 1], data[i + 2]))] += 1; n += 1; }
  let acc = 0;
  for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= n / 2) return v; }
  return 230;
}

// صورة PNG شفافة: بكسلاتها الشفافة سوداء اللون في الحقيقة (شفافيتها
// وحدها تخفيها)، فلو قُرئت إضاءتها كما هي لحُسبت الخلفية كلها حبراً.
// فتُبسط الصورة على ورق أبيض أولاً. وإن كان الحبر نفسه فاتحاً (توقيع
// أبيض على شفاف) قُلبت ألوانه ليصير حبراً داكناً على ورق.
function flattenOnPaper(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let transparent = 0, opaque = 0, opaqueLum = 0;
  for (let i = 0; i < d.length; i += 16) {
    if (d[i + 3] < 128) transparent += 1;
    else { opaque += 1; opaqueLum += lum(d[i], d[i + 1], d[i + 2]); }
  }
  if (!transparent) return; // لا شفافية: صورة ورق عادية
  const lightInk = opaque > 0 && opaqueLum / opaque > 170;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    for (let k = 0; k < 3; k += 1) {
      const c = lightInk ? 255 - d[i + k] : d[i + k];
      d[i + k] = Math.round(c * a + 255 * (1 - a));
    }
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** حدود الحبر في منطقة من الصورة: ما أغمق من العتبة */
function inkBounds(data, w, h, threshold) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 0 && lum(data[i], data[i + 1], data[i + 2]) < threshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export default function SignatureEditor({ file, onCancel, onSave }) {
  const [work, setWork] = useState(null);          // canvas العمل (بعد التدوير والتصغير)
  const [crop, setCrop] = useState(null);          // {x,y,w,h} بإحداثيات صورة العمل
  const [threshold, setThreshold] = useState(185);
  const [ink, setInk] = useState('navy');
  const [result, setResult] = useState(null);      // dataURL الناتج
  const [error, setError] = useState('');
  const viewRef = useRef(null);
  const dragRef = useRef(null);

  // تحميل الصورة وتصغيرها لمقاس عمل معقول
  const prepare = useCallback(async (rotate = 0, base = null) => {
    try {
      let source = base;
      if (!source) {
        const normalized = await normalizeImageFile(file);
        const url = URL.createObjectURL(normalized);
        try { source = await loadImage(url); } finally { URL.revokeObjectURL(url); }
      }
      const sw = source.naturalWidth || source.width;
      const sh = source.naturalHeight || source.height;
      const k = Math.min(1, WORK_MAX / Math.max(sw, sh));
      const w = Math.round(sw * k), h = Math.round(sh * k);
      const c = document.createElement('canvas');
      const rotated = rotate % 180 !== 0;
      c.width = rotated ? h : w;
      c.height = rotated ? w : h;
      const ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(source, -w / 2, -h / 2, w, h);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (!base) flattenOnPaper(ctx, c.width, c.height);
      setWork(c);
      setCrop(null);
    } catch {
      setError('تعذّر قراءة الصورة');
    }
  }, [file]);

  useEffect(() => { prepare(0); }, [prepare]);

  const rotate = () => { if (work) prepare(90, work); };

  // قص تلقائي: أصغر مستطيل يحيط بالحبر، بهامش صغير.
  // الحبر ما كان أغمق من الورق بفارق واضح — فظلّ الصورة وتدرّج الإضاءة
  // لا يُحسبان حبراً.
  const autoCrop = useCallback((tune = false) => {
    if (!work) return;
    const ctx = work.getContext('2d');
    const { data } = ctx.getImageData(0, 0, work.width, work.height);
    const paper = paperLuminance(data);
    if (tune) setThreshold(Math.max(90, Math.min(240, paper - 28)));
    const b = inkBounds(data, work.width, work.height, Math.min(threshold, paper - 55));
    if (!b) { setError('لم يُعثر على حبر — خفّف «إزالة الخلفية» قليلاً'); return; }
    const pad = Math.round(Math.max(b.w, b.h) * 0.04);
    const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
    setCrop({ x, y, w: Math.min(work.width - x, b.w + pad * 2), h: Math.min(work.height - y, b.h + pad * 2) });
    setError('');
  }, [work, threshold]);

  // أول تحميل: قص تلقائي
  // وتُضبط إزالة الخلفية على إضاءة الورق نفسها
  useEffect(() => { if (work && !crop) autoCrop(true); }, [work]); // eslint-disable-line react-hooks/exhaustive-deps

  // المعالجة: قص ← إزالة الخلفية ← لون الحبر ← تقليم ← مقاس ثابت
  useEffect(() => {
    if (!work) return;
    const r = crop || { x: 0, y: 0, w: work.width, h: work.height };
    if (r.w < 4 || r.h < 4) return;
    const c = document.createElement('canvas');
    c.width = r.w; c.height = r.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(work, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    const img = ctx.getImageData(0, 0, r.w, r.h);
    const d = img.data;
    const color = INKS.find((i) => i.key === ink)?.color;
    // انتقال ناعم عند حافة العتبة يحفظ نعومة الخط
    const soft = Math.max(18, threshold * 0.22);
    for (let i = 0; i < d.length; i += 4) {
      const L = lum(d[i], d[i + 1], d[i + 2]);
      let a = (threshold - L) / soft;
      a = a <= 0 ? 0 : a >= 1 ? 1 : a;
      d[i + 3] = Math.round(a * 255);
      if (color && a > 0) { d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; }
    }
    ctx.putImageData(img, 0, 0);

    // تقليم ما بقي شفافاً حول الحبر
    let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
    for (let y = 0; y < r.h; y += 1) {
      for (let x = 0; x < r.w; x += 1) {
        if (d[(y * r.w + x) * 4 + 3] > 24) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) { setResult(null); return; }
    const pad = 6;
    const tw = x1 - x0 + 1, th = y1 - y0 + 1;
    const k = Math.min(1, (OUT_MAX_W - pad * 2) / tw, (OUT_MAX_H - pad * 2) / th);
    const out = document.createElement('canvas');
    out.width = Math.round(tw * k) + pad * 2;
    out.height = Math.round(th * k) + pad * 2;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(c, x0, y0, tw, th, pad, pad, Math.round(tw * k), Math.round(th * k));
    setResult(out.toDataURL('image/png'));
  }, [work, crop, threshold, ink]);

  // ── رسم منطقة التحرير مع مستطيل القص ──
  const scale = work ? Math.min(1, VIEW_W / work.width, 360 / work.height) : 1;
  useEffect(() => {
    const v = viewRef.current;
    if (!v || !work) return;
    v.width = Math.round(work.width * scale);
    v.height = Math.round(work.height * scale);
    const ctx = v.getContext('2d');
    ctx.drawImage(work, 0, 0, v.width, v.height);
    if (crop) {
      const cx = crop.x * scale, cy = crop.y * scale, cw = crop.w * scale, ch = crop.h * scale;
      ctx.fillStyle = 'rgba(28,46,48,0.45)';
      ctx.fillRect(0, 0, v.width, cy);
      ctx.fillRect(0, cy + ch, v.width, v.height - cy - ch);
      ctx.fillRect(0, cy, cx, ch);
      ctx.fillRect(cx + cw, cy, v.width - cx - cw, ch);
      ctx.strokeStyle = '#C6AA76';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cx + 1, cy + 1, cw - 2, ch - 2);
    }
  }, [work, crop, scale]);

  // سحب مستطيل قص جديد بالفأرة أو الإصبع
  const toImage = (e) => {
    const rect = viewRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * viewRef.current.width;
    const py = ((e.clientY - rect.top) / rect.height) * viewRef.current.height;
    return { x: Math.max(0, Math.min(work.width, px / scale)), y: Math.max(0, Math.min(work.height, py / scale)) };
  };
  const onDown = (e) => { if (!work) return; e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = toImage(e); };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const a = dragRef.current, b = toImage(e);
    setCrop({ x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)), w: Math.round(Math.abs(b.x - a.x)), h: Math.round(Math.abs(b.y - a.y)) });
  };
  const onUp = () => { dragRef.current = null; };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sig-editor-title">
      <div className="my-6 w-full max-w-3xl overflow-hidden rounded-[20px] border border-border bg-white shadow-deep">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="sig-editor-title" className="text-lg font-extrabold text-text-main">تجهيز التوقيع</h2>
          <button type="button" onClick={onCancel} aria-label="إغلاق" className="rounded-full p-2 text-text-soft hover:bg-background"><X size={18} /></button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_230px]">
          {/* ── منطقة القص ── */}
          <div>
            <p className="mb-2 text-xs text-text-soft">اسحب على الصورة لتحديد التوقيع، أو اضغط «قص تلقائي».</p>
            <div className="grid min-h-[200px] place-items-center rounded-xl bg-background p-2">
              {work ? (
                <canvas ref={viewRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
                  className="max-w-full cursor-crosshair touch-none rounded-lg" aria-label="الصورة الأصلية — اسحب لتحديد منطقة القص" />
              ) : (
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              <button type="button" onClick={() => autoCrop(true)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                <Wand2 size={15} aria-hidden="true" /> قص تلقائي
              </button>
              <button type="button" onClick={() => setCrop(null)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                <Crop size={15} aria-hidden="true" /> الصورة كاملة
              </button>
              <button type="button" onClick={rotate} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-text-soft hover:bg-background hover:text-primary">
                <RotateCw size={15} aria-hidden="true" /> تدوير
              </button>
            </div>
          </div>

          {/* ── الضبط والمعاينة ── */}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-xs font-bold text-text-main">
                <span className="inline-flex items-center gap-1"><Eraser size={14} aria-hidden="true" /> إزالة الخلفية</span>
                <span className="text-text-soft">{Math.round(((threshold - 90) / 150) * 100)}%</span>
              </span>
              <input type="range" min="90" max="240" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-[#2E6066]" aria-label="قوة إزالة الخلفية" />
              <span className="mt-0.5 block text-[11px] text-text-soft">ارفعها حتى تختفي الخلفية، واخفضها إن بهت الحبر.</span>
            </label>

            <div>
              <span className="mb-1 block text-xs font-bold text-text-main">لون الحبر</span>
              <div className="flex flex-wrap gap-1.5">
                {INKS.map((i) => (
                  <button key={i.key} type="button" onClick={() => setInk(i.key)} aria-pressed={ink === i.key}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold ${ink === i.key ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-soft'}`}>
                    {i.color && <span className="h-3 w-3 rounded-full" style={{ background: `rgb(${i.color.join(',')})` }} />}
                    {i.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-xs font-bold text-text-main">كما يظهر في الشهادة</span>
              <div className="rounded-xl border border-border p-3 text-center"
                style={{ backgroundImage: 'linear-gradient(45deg,#eef1f1 25%,transparent 25%),linear-gradient(-45deg,#eef1f1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#eef1f1 75%),linear-gradient(-45deg,transparent 75%,#eef1f1 75%)', backgroundSize: '14px 14px', backgroundPosition: '0 0,0 7px,7px -7px,-7px 0' }}>
                <p className="text-[11px] font-bold text-primary">منسق البرنامج</p>
                <div className="my-1 flex h-[64px] items-center justify-center">
                  {result
                    ? <img src={result} alt="معاينة التوقيع" className="max-h-[64px] max-w-[170px] object-contain" />
                    : <span className="text-[11px] text-text-soft">لا حبر ظاهر</span>}
                </div>
                <p className="text-[11px] font-bold text-text-main">اسم المنسق</p>
              </div>
            </div>
            {error && <p className="text-[12px] font-bold text-danger">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1 border-t border-border bg-background px-5 py-3">
          <button type="button" onClick={() => result && onSave(result)} disabled={!result}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
            <Check size={15} aria-hidden="true" /> حفظ التوقيع
          </button>
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-[13px] font-bold text-text-soft hover:bg-white">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
