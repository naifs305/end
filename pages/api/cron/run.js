// =============================================================
// GET /api/cron/run
// -------------------------------------------------------------
// نقطة الدخول لنظام الجدولة. تُستدعى من «فرسيل كرون» يومياً،
// وتشغّل جميع المهام المستحقة بالتوازي.
//
// الحماية: يُشترط وجود رأس Authorization يحتوي على CRON_SECRET
// (تلقائياً عند استدعاء فرسيل، أو يدوياً للاختبار)
// =============================================================

const scheduler = require('../../../lib/services/scheduler');

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ message: 'طريقة غير مسموحة' });
  }

  // التحقق من سرّ الكرون (يضبطه فرسيل تلقائياً)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ message: 'غير مصرح — مطلوب سر الكرون' });
    }
  }

  try {
    const summary = await scheduler.runDueJobs();
    return res.status(200).json(summary);
  } catch (err) {
    console.error('خطأ في تشغيل الكرون:', err);
    return res.status(500).json({ message: err.message });
  }
}

module.exports = handler;
module.exports.default = handler;
