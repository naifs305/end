// POST /api/auth/reset-password  { token, password }
const prisma  = require('../../../lib/db/prisma');
const bcrypt  = require('bcryptjs');

function withMethods(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return res.status(405).json({ message: 'Method Not Allowed' });
    return handler(req, res);
  };
}

async function handler(req, res) {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ message: 'البيانات مطلوبة' });
  if (password.length < 6) return res.status(400).json({ message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, "resetTokenExpiry" FROM "User" WHERE "resetToken"=$1 AND "isActive"=true LIMIT 1`,
    token,
  );
  const user = rows[0];
  if (!user) return res.status(400).json({ message: 'الرابط غير صالح أو منتهي الصلاحية' });
  if (new Date(user.resetTokenExpiry) < new Date()) return res.status(400).json({ message: 'انتهت صلاحية الرابط — أرسل طلباً جديداً' });

  const hash = await bcrypt.hash(password, 10);
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "passwordHash"=$1, "resetToken"=NULL, "resetTokenExpiry"=NULL WHERE id=$2`,
    hash, user.id,
  );

  return res.status(200).json({ message: 'تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن' });
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
