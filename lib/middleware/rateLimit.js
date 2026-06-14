// Rate limiting بسيط في الذاكرة — مناسب لبيئة Vercel serverless
// كل instance يملك ذاكرته، لكن يكفي لصد الهجمات الواضحة

const store = new Map();

function cleanup() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.windowStart > record.windowMs * 2) {
      store.delete(key);
    }
  }
}

// تنظيف دوري كل دقيقة
setInterval(cleanup, 60_000);

/**
 * withRateLimit — wrapper لمسارات Next.js API
 * @param {object} options
 * @param {number} options.maxAttempts  - الحد الأقصى للمحاولات في النافذة الزمنية
 * @param {number} options.windowMs     - النافذة الزمنية بالمللي ثانية
 * @param {function} handler            - معالج المسار
 */
function withRateLimit({ maxAttempts = 10, windowMs = 60_000 } = {}) {
  return function (handler) {
    return async (req, res) => {
      const ip =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        'unknown';

      const key = `${ip}::${req.url}`;
      const now = Date.now();

      let record = store.get(key);

      if (!record || now - record.windowStart >= windowMs) {
        record = { windowStart: now, count: 0, windowMs };
        store.set(key, record);
      }

      record.count += 1;

      if (record.count > maxAttempts) {
        const retryAfter = Math.ceil((record.windowStart + windowMs - now) / 1000);
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          message: 'محاولات كثيرة جداً، يرجى الانتظار قليلاً ثم المحاولة مجدداً',
        });
      }

      return handler(req, res);
    };
  };
}

module.exports = { withRateLimit };
