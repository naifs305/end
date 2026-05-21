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

  // دائماً أرجع 200 لمنع تخمين الحسابات
  const user = await prisma.user.findUnique({ where: { email: userEmail.trim().toLowerCase() } });
  if (!user || !user.isActive) return res.status(200).json({ message: 'إذا كان الحساب موجوداً، ستصل رسالة خلال لحظات' });

  const token  = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "resetToken"=$1, "resetTokenExpiry"=$2 WHERE id=$3`,
    token, expiry, user.id,
  );

  await email.sendPasswordReset({
    to:         user.email,
    firstName:  user.firstName,
    resetToken: token,
  });

  return res.status(200).json({ message: 'إذا كان الحساب موجوداً، ستصل رسالة خلال لحظات' });
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
