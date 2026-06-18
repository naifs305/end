// =============================================================
// GET /api/cron/run
// -------------------------------------------------------------
// نقطة الدخول لنظام الجدولة. تُستدعى من «فرسيل كرون» يومياً،
// وتشغّل جميع المهام المستحقة بالتوازي.
//
// الحماية: يُشترط وجود رأس Authorization يحتوي على CRON_SECRET
// (تلقائياً عند استدعاء فرسيل، أو يدوياً للاختبار)
// =============================================================

const crypto = require('crypto');
const scheduler = require('../../../lib/modules/scheduling/scheduling.service');

// مقارنة ثابتة الزمن لتفادي قنوات التوقيت الجانبية
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'طريقة غير مسموحة', code: 'serverErrors.cron.methodNotAllowed' });
  }

  // الحماية تُغلق افتراضياً: يجب ضبط CRON_SECRET، ويجب مطابقة الترويسة (مقارنة ثابتة الزمن)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ message: 'الكرون غير مُهيأ — اضبط CRON_SECRET', code: 'serverErrors.cron.notConfigured' });
  }
  const auth = req.headers.authorization || '';
  if (!safeEqual(auth, `Bearer ${cronSecret}`)) {
    return res.status(401).json({ message: 'غير مصرح — مطلوب سر الكرون', code: 'serverErrors.cron.unauthorized' });
  }

  try {
    const summary = await scheduler.runDueJobs();
    return res.status(200).json(summary);
  } catch (err) {
    console.error('خطأ في تشغيل الكرون:', err);
    return res.status(500).json({ message: err.message, code: err.code || 'serverErrors.common.serverError' });
  }
}

module.exports = handler;
module.exports.default = handler;
