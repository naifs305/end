// =============================================================
// POST /api/auth/login
// -------------------------------------------------------------
// يستقبل بريداً وكلمة مرور، يرجع رمز مصادقة وبيانات المستخدم
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { verifyPassword, signToken, hashPassword } = require('../../../lib/auth/jwt');
const { withMethods } = require('../../../lib/middleware/auth');

// --- حساب الطوارئ (في حال فقد كل المستخدمين) ---
async function ensureEmergencyUser() {
  let project = await prisma.operationalProject.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!project) {
    project = await prisma.operationalProject.create({
      data: { name: 'مشروع القيادة الأمنية' },
    });
  }

  let user = await prisma.user.findFirst({
    where: {
      email: { equals: 'Nalshahrani@nauss.edu.sa', mode: 'insensitive' },
    },
    include: { operationalProject: true },
  });

  if (!user) {
    const passwordHash = await hashPassword('Zx.321321');
    user = await prisma.user.create({
      data: {
        email: 'Nalshahrani@nauss.edu.sa',
        passwordHash,
        firstName: 'نايف',
        lastName: 'الشهراني',
        mobileNumber: '0568122221',
        roles: ['MANAGER', 'EMPLOYEE'],
        operationalProjectId: project.id,
        isActive: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      },
      include: { operationalProject: true },
    });
  } else if (!user.isActive) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: true, roles: ['MANAGER', 'EMPLOYEE'] },
      include: { operationalProject: true },
    });
  }

  return user;
}

function buildLoginResponse(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    roles: user.roles,
  };

  return {
    access_token: signToken(payload),
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      project: user.operationalProject,
    },
  };
}

async function handler(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'البريد وكلمة المرور مطلوبان' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // مسار الطوارئ
  if (normalizedEmail === 'nalshahrani@nauss.edu.sa' && password === 'Zx.321321') {
    try {
      const emergency = await ensureEmergencyUser();
      return res.status(200).json(buildLoginResponse(emergency));
    } catch (err) {
      console.error('خطأ في حساب الطوارئ:', err);
    }
  }

  const user = await prisma.user.findFirst({
    where: {
      email: { equals: String(email).trim(), mode: 'insensitive' },
    },
    include: { operationalProject: true },
  });

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
  }

  return res.status(200).json(buildLoginResponse(user));
}

module.exports = withMethods(['POST'], handler);
module.exports.default = module.exports;
