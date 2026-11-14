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
// المتصفح فـ JPEG) — نسخة عرض حتى ٢٠٠٠ نقطة ومصغّرة حتى ٥٦٠ نقطة.
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
    const fullCanvas = await drawScaled(img, 2000);
    const thumbCanvas = await drawScaled(img, 560);
    return {
      full: toCompressed(fullCanvas, 0.84),
      thumb: toCompressed(thumbCanvas, 0.8),
      width: fullCanvas.width,
      height: fullCanvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
