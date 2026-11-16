// =============================================================
// روابط صور التوثيق
// -------------------------------------------------------------
// الصورة تُعرض بوسم <img>، والوسم لا يحمل هوية الدخول. فصور التوثيق
// قبل نشره تُطلب برابط موقَّع قصير العمر (يصنعه الخادم لمن يملك
// الاطلاع)، وصور التوثيق المنشور تُطلب برابطها العام بلا توقيع.
// =============================================================
const crypto = require('crypto');

const TTL_SECONDS = 6 * 3600;

function secret() {
  return process.env.MEDIA_URL_SECRET || process.env.JWT_SECRET || 'dev-media-secret';
}

function signature(mediaId, size, expires) {
  return crypto.createHmac('sha256', secret()).update(`${mediaId}|${size}|${expires}`).digest('base64url').slice(0, 32);
}

/** رابط موقَّع يصلح ست ساعات */
function signedUrl(mediaId, size = 'thumb', now = Date.now()) {
  const e = Math.floor(now / 1000) + TTL_SECONDS;
  return `/api/documentation/media/${mediaId}?s=${size}&e=${e}&t=${signature(mediaId, size, e)}`;
}

/** رابط عام لصور التوثيق المنشور */
function publicUrl(mediaId, size = 'thumb') {
  return `/api/documentation/media/${mediaId}?s=${size}`;
}

function verify(mediaId, size, e, t, now = Date.now()) {
  const exp = Number(e);
  if (!exp || !t || exp * 1000 < now) return false;
  const expected = signature(mediaId, size, exp);
  const a = Buffer.from(String(t));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// صور المتدربين داخلية دائماً: تُطلب بمفتاحها وتوقيع قصير العمر
function signedKeyUrl(key, now = Date.now()) {
  const e = Math.floor(now / 1000) + TTL_SECONDS;
  return `/api/documentation/file?k=${encodeURIComponent(key)}&e=${e}&t=${signature(`key:${key}`, 'file', e)}`;
}

function verifyKey(key, e, t, now = Date.now()) {
  return verify(`key:${key}`, 'file', e, t, now);
}

module.exports = { TTL_SECONDS, signedUrl, publicUrl, verify, signedKeyUrl, verifyKey };
