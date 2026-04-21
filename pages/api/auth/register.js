// =============================================================
// POST /api/auth/register
// -------------------------------------------------------------
// إنشاء حساب جديد
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { hashPassword, signToken } = require('../../../lib/auth/jwt');
const { withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const {
    firstName,
    lastName,
    email,
    mobileNumber,
    extensionNumber,
    password,
    operationalProjectId,
    acceptTerms,
  } = req.body || {};

  // --- التحقق من المدخلات ---
  if (!acceptTerms) {
    return res.status(400).json({ message: 'يجب الموافقة على شروط الاستخدام' });
  }

  if (!email || !password || !firstName || !lastName || !mobileNumber || !operationalProjectId) {
    return res.status(400).json({ message: 'جميع الحقول الأساسية مطلوبة' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // --- التحقق من عدم التكرار ---
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: 'insensitive' },
    },
  });

  if (existing) {
    return res.status(400).json({ message: 'البريد الإلكتروني مستخدم مسبقاً' });
  }

  // --- إنشاء المستخدم ---
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      mobileNumber,
      extensionNumber: extensionNumber || null,
      operationalProjectId,
      roles: ['EMPLOYEE'],
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
    include: { operationalProject: true },
  });

  const token = signToken({ sub: user.id, email: user.email, roles: user.roles });

  return res.status(201).json({
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      project: user.operationalProject,
    },
  });
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
