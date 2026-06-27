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
