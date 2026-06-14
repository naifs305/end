// POST /api/auth/forgot-password  { email }
const prisma   = require('../../../lib/db/prisma');
const crypto   = require('crypto');
const email    = require('../../../lib/email');

function withMethods(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return res.status(405).json({ message: 'Method Not Allowed' });
    return handler(req, res);
  };
}

async function handler(req, res) {
  const { email: userEmail } = req.body || {};
  if (!userEmail?.trim()) return res.status(400).json({ message: 'البريد الإلكتروني مطلوب' });

  try {
    // دائماً أرجع 200 لمنع تخمين الحسابات
    const user = await prisma.user.findFirst({
      where: { email: { equals: userEmail.trim(), mode: 'insensitive' } },
    });
    if (!user || !user.isActive) {
      return res.status(200).json({ message: 'إذا كان الحساب موجوداً، ستصل رسالة خلال لحظات' });
    }

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "resetToken"=$1, "resetTokenExpiry"=$2 WHERE id=$3::uuid`,
      token, expiry, user.id,
    );

    // إرسال البريد (لا نوقف العملية إذا فشل البريد)
    try {
      await email.sendPasswordReset({ to: user.email, firstName: user.firstName, resetToken: token });
    } catch (emailErr) {
      console.error('[forgot-password] email error:', emailErr?.message);
    }

    return res.status(200).json({ message: 'إذا كان الحساب موجوداً، ستصل رسالة خلال لحظات' });
  } catch (err) {
    console.error('[forgot-password] error:', err?.message);
    return res.status(500).json({ message: 'حدث خطأ في الخادم، حاول لاحقاً' });
  }
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
