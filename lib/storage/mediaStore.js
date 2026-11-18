// =============================================================
// مخزن صور التوثيق
// -------------------------------------------------------------
// الصور تصل مضغوطة من المتصفح (WebP)، فلا تحتاج المنصة مكتبات
// معالجة على الخادم. وتُحفظ ملفاتٍ في مجلد دائم:
//   • على خادم الجامعة: مجلد الحاوية /app/storage/media، وهو مربوط
//     بمخزن دائم في docker-compose.yml (media)، فلا يضيع مع كل نشر.
//   • على جهاز التطوير: C:\nif\end\storage\media (خارج المستودع).
// ويُغيَّر المكان بمتغيّر MEDIA_STORAGE_DIR إن لزم.
//
// المفتاح وحده هو ما يُخزَّن في قاعدة البيانات، ولا يُقبل مفتاح
// يخرج عن المجلد (لا «..» ولا مسارات مطلقة).
// =============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(process.cwd(), 'storage', 'media'));

// pdf لمرفقات مراجعة الشهادات (تُحذف بعد اعتماد المراجعة)
const KEY_RE = /^[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{8,64}\.(webp|jpg|png|pdf)$/;

function assertKey(key) {
  if (!KEY_RE.test(String(key || ''))) {
    const err = new Error('مفتاح ملف غير صالح');
    err.statusCode = 400;
    throw err;
  }
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) {
    const err = new Error('مفتاح ملف غير صالح');
    err.statusCode = 400;
    throw err;
  }
  return full;
}

/** مفتاح جديد داخل مجلد الدورة */
function newKey(folder, ext = 'webp') {
  const safeFolder = String(folder || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) || 'misc';
  return `${safeFolder}/${crypto.randomBytes(12).toString('hex')}.${ext}`;
}

async function save(key, buffer) {
  const full = assertKey(key);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
  return key;
}

function readStream(key) {
  return fs.createReadStream(assertKey(key));
}

async function exists(key) {
  try { await fs.promises.access(assertKey(key)); return true; } catch { return false; }
}

async function remove(key) {
  try { await fs.promises.unlink(assertKey(key)); } catch { /* محذوف من قبل */ }
}

module.exports = { ROOT, KEY_RE, assertKey, newKey, save, readStream, exists, remove };
