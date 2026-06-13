// =============================================================
// GET/POST /api/admin/email-test
// -------------------------------------------------------------
// اختبار إعدادات البريد الإلكتروني — حصري للمدير
// GET: عرض حالة الإعدادات
// POST: إرسال رسالة اختبار إلى بريد محدد (أو بريد المستخدم الحالي)
// =============================================================

const { withManager, withMethods } = require('../../../lib/middleware/auth');
const { getEmailConfigurationStatus, sendTestEmail } = require('../../../lib/email');

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json(getEmailConfigurationStatus());
  }

  const body = req.body || {};
  const targetEmail = typeof body.to === 'string' && body.to.trim()
    ? body.to.trim().toLowerCase()
    : req.user.email;

  const fullName = `${req.user.firstName} ${req.user.lastName}`;
  const sent = await sendTestEmail({ to: targetEmail, fullName });

  return res.status(200).json({ sent: !!sent, to: targetEmail });
}

module.exports = withManager(withMethods(['GET', 'POST'], handler));
