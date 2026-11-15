// أدوات صور العميل — تطبّع صور آيفون بصيغة HEIC/HEIF إلى JPEG قبل أي معالجة
// لأن المتصفحات (Canvas/<img>) لا تستطيع فك تشفير HEIC أصلاً

const HEIC_EXTENSION_RE = /\.(heic|heif)$/i;

export function isHeicFile(file) {
  const type = (file.type || '').toLowerCase();
  if (type === 'image/heic' || type === 'image/heif') return true;
  // بعض المتصفحات لا تُرسل نوع MIME صحيح لملفات HEIC فنعتمد على الامتداد
  if (!type || type === 'application/octet-stream') return HEIC_EXTENSION_RE.test(file.name || '');
  return false;
}

export function isAcceptableImageFile(file) {
  if ((file.type || '').startsWith('image/')) return true;
  return isHeicFile(file);
}

// يحوّل ملف HEIC إلى JPEG؛ يُعيد الملف كما هو إن لم يكن HEIC
export async function normalizeImageFile(file) {
  if (!isHeicFile(file)) return file;

  const heic2any = (await import('heic2any')).default;
  const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
  const newName = (file.name || 'image').replace(HEIC_EXTENSION_RE, '') + '.jpg';
  return new File([blob], newName, { type: 'image/jpeg' });
}

// صورة شخصية صغيرة مربّعة (قصّ من الوسط) بصيغة JPEG — فتظهر في البطاقات
// والقوائم دون أن تُثقل الصفحة. صورة الجوال الأصلية قد تبلغ ميجابايتات.
export async function fileToAvatarDataUrl(file, size = 320, quality = 0.86) {
  const normalized = await normalizeImageFile(file);
  const url = URL.createObjectURL(normalized);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// التوقيع الإلكتروني: يُصغَّر مع إبقاء نسبته وشفافيته (PNG)، فيُطبع
// فوق المستند بلا خلفية بيضاء تغطي ما تحته.
export async function fileToSignatureDataUrl(file, maxWidth = 600) {
  const normalized = await normalizeImageFile(file);
  const url = URL.createObjectURL(normalized);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxWidth / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

// صورة توثيق الدورة: تُضغط في المتصفح قبل الرفع (WebP، وإن لم يدعمه
// المتصفح فـ JPEG) — نسخة عرض حتى ٢٤٠٠ نقطة بجودة عالية تصلح للطباعة،
// ومصغّرة حتى ٦٤٠ نقطة. والتعديلات بعد ذلك (تركيز، تقريب، فلتر) أرقام
// تُطبَّق عند العرض، فلا تُعاد كتابة الصورة ولا تفقد جودتها.
// فلا تحتاج المنصة مكتبات معالجة صور على الخادم.
async function drawScaled(img, maxSide) {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function toCompressed(canvas, quality) {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}

export async function fileToDocumentationPhoto(file) {
  const normalized = await normalizeImageFile(file);
  const url = URL.createObjectURL(normalized);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const fullCanvas = await drawScaled(img, 2400);
    const thumbCanvas = await drawScaled(img, 640);
    return {
      full: toCompressed(fullCanvas, 0.9),
      thumb: toCompressed(thumbCanvas, 0.82),
      width: fullCanvas.width,
      height: fullCanvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}

/**
 * تدوير صورة توثيق ربع دورة (dir = 1 مع عقارب الساعة، -1 عكسها).
 * يُعاد ترميزها مرة واحدة بأعلى جودة (0.95) من النسخة المحفوظة.
 */
export async function rotateDocumentationPhoto(src, dir = 1) {
  const img = await loadImage(src);
  const w = img.naturalWidth; const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = h; c.height = w;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((dir >= 0 ? 90 : -90) * Math.PI / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  const thumbImg = await loadImage(c.toDataURL('image/png'));
  const thumbCanvas = await drawScaled(thumbImg, 640);
  return { full: toCompressed(c, 0.95), thumb: toCompressed(thumbCanvas, 0.82), width: c.width, height: c.height };
}

/** إحصاءات إضاءة الصورة (متوسط وانتشار بين ٠ و١) — للتحسين التلقائي */
export async function imageLightStats(src) {
  const img = await loadImage(src);
  const c = await drawScaled(img, 160);
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let sum = 0; let sq = 0; let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    sum += l; sq += l * l; n += 1;
  }
  const mean = sum / n;
  return { mean, spread: Math.sqrt(Math.max(0, sq / n - mean * mean)) };
}

/**
 * ضغط صورة التوثيق بعد النشر: يُثبَّت فيها القصّ (والفلتر إن دعمه المتصفح)،
 * وتُصغَّر إلى ما تحتاجه المجلة والطباعة (٢٠٠٠ نقطة للضلع الأطول)، ثم تحلّ
 * محل الأصل على الخادم — فينزل حجمها إلى نحو النصف أو أقل ولا يتغيّر شكلها.
 * edit: تعديل الصورة الحالي، و filterCss: قيمة filter في CSS (أو لا شيء).
 */
export async function bakeDocumentationPhoto(src, edit, filterCss, maxSide = 2000) {
  const img = await loadImage(src);
  const W = img.naturalWidth; const H = img.naturalHeight;
  const c0 = edit?.crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(c0.x * W); const sy = Math.round(c0.y * H);
  const sw = Math.max(1, Math.round(c0.w * W)); const sh = Math.max(1, Math.round(c0.h * H));
  const k = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * k); canvas.height = Math.round(sh * k);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // الفلتر يُثبَّت إن دعم المتصفح فلاتر اللوحة؛ وإلا بقي رقماً يُطبَّق عند العرض
  const filterBaked = !!filterCss && typeof ctx.filter === 'string';
  if (filterBaked) ctx.filter = filterCss;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const thumbImg = await loadImage(canvas.toDataURL('image/jpeg', 0.92));
  const thumbCanvas = await drawScaled(thumbImg, 480);
  return {
    full: toCompressed(canvas, 0.86),
    thumb: toCompressed(thumbCanvas, 0.78),
    width: canvas.width,
    height: canvas.height,
    filterBaked,
  };
}
