// تحديد معدّل الطلبات (Rate limiting).
//
// المخزن قابل للاستبدال: الافتراضي في الذاكرة (لكل instance)، ويمكن حقن مخزن
// مشترك (Redis/Upstash) عبر setRateLimitStore() ليصبح التحديد دقيقاً عبر كل
// النسخ على Vercel — دون لمس مواضع الاستدعاء.
//
// اشتقاق IP محصّن ضد الانتحال: لا نثق بأوائل x-forwarded-for (يضيفها العميل)،
// بل نعدّ من نهاية القائمة بمقدار عدد القفزات الموثوقة (TRUST_PROXY_HOPS).

// عدد الوسطاء الموثوقين أمام التطبيق (Vercel = 1). يحدّد أي إدخال في
// x-forwarded-for يمثّل العميل الحقيقي (العدّ من النهاية).
const TRUST_PROXY_HOPS = Math.max(1, parseInt(process.env.TRUST_PROXY_HOPS || '1', 10) || 1);

function clientIp(req) {
  // x-real-ip يضبطه الوسيط الموثوق ولا يمكن للعميل تزويره خلفه
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  const xff = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (xff.length) {
    // الإدخال الموثوق = القفزة رقم TRUST_PROXY_HOPS من النهاية
    const idx = Math.max(0, xff.length - TRUST_PROXY_HOPS);
    return xff[idx];
  }
  return req.socket?.remoteAddress || 'unknown';
}

// ── المخزن الافتراضي في الذاكرة ──────────────────────────────────────
function createMemoryStore() {
  const map = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of map.entries()) {
      if (now - record.windowStart > record.windowMs * 2) map.delete(key);
    }
  }, 60_000);
  if (timer.unref) timer.unref(); // لا يمنع إنهاء العملية
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async set(key, record) {
      map.set(key, record);
    },
  };
}

let activeStore = createMemoryStore();

/**
 * setRateLimitStore — حقن مخزن مشترك (Redis/Upstash).
 * المخزن يلزمه { get(key), set(key, record) } غير متزامنين، ويُفضَّل أن يوفّر
 * incr(key, windowMs) ذرّياً يُرجع { count, windowStart } للدقة عبر النسخ.
 */
function setRateLimitStore(store) {
  // تمرير قيمة خاوية يعيد المخزن الافتراضي في الذاكرة
  activeStore = store || createMemoryStore();
}

// يزيد العدّاد للمفتاح ضمن النافذة، مفضّلاً عملية incr الذرّية إن توفّرت.
async function hit(key, windowMs) {
  if (typeof activeStore.incr === 'function') {
    return activeStore.incr(key, windowMs);
  }
  const now = Date.now();
  let record = await activeStore.get(key);
  if (!record || now - record.windowStart >= windowMs) {
    record = { windowStart: now, count: 0, windowMs };
  }
  record.count += 1;
  await activeStore.set(key, record);
  return record;
}

/**
 * withRateLimit — غلاف لمسارات Next.js API
 * @param {object} options
 * @param {number} options.maxAttempts - الحد الأقصى للمحاولات في النافذة
 * @param {number} options.windowMs    - النافذة الزمنية بالمللي ثانية
 */
function withRateLimit({ maxAttempts = 10, windowMs = 60_000 } = {}) {
  return function (handler) {
    return async (req, res) => {
      const key = `${clientIp(req)}::${req.url}`;
      const record = await hit(key, windowMs);

      if (record.count > maxAttempts) {
        const retryAfter = Math.max(1, Math.ceil((record.windowStart + windowMs - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          message: 'محاولات كثيرة جداً، يرجى الانتظار قليلاً ثم المحاولة مجدداً',
        });
      }

      return handler(req, res);
    };
  };
}

module.exports = { withRateLimit, setRateLimitStore, clientIp };
