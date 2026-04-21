// =============================================================
// وسيطيات الحماية للمسارات (محدّثة لدعم الأدوار الثلاثة)
// =============================================================

const { getUserFromRequest, getActiveRole } = require('../auth/jwt');
const prisma = require('../db/prisma');
const { resolveActiveRole } = require('../services/permissions');

/**
 * يتطلب تسجيل دخول صالح. يُحمّل المستخدم من قاعدة البيانات
 * ويضع البيانات في req.user و req.activeRole.
 */
function withAuth(handler) {
  return async (req, res) => {
    const payload = getUserFromRequest(req);
    if (!payload || !payload.sub) {
      return res.status(401).json({ message: 'غير مصادق — يلزم تسجيل الدخول' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { operationalProject: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'الحساب غير موجود أو معطّل' });
    }

    const headerRole = getActiveRole(req);
    const activeRole = resolveActiveRole(user, headerRole);

    req.user = user;
    req.activeRole = activeRole;

    return handler(req, res);
  };
}

/**
 * يتطلب دور المدير فقط
 */
function withManager(handler) {
  return withAuth(async (req, res) => {
    if (req.activeRole !== 'MANAGER') {
      return res.status(403).json({ message: 'يتطلب صلاحيات المدير' });
    }
    return handler(req, res);
  });
}

/**
 * يتطلب المدير أو مشرف المشروع (الصلاحيات الإدارية العامة)
 */
function withManagerOrSupervisor(handler) {
  return withAuth(async (req, res) => {
    if (req.activeRole !== 'MANAGER' && req.activeRole !== 'PROJECT_SUPERVISOR') {
      return res.status(403).json({ message: 'يتطلب صلاحيات إدارية' });
    }
    return handler(req, res);
  });
}

/**
 * يتطلب دوراً محدداً (لأي استخدام مخصص)
 */
function withActiveRole(allowedRoles, handler) {
  return withAuth(async (req, res) => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    if (!roles.includes(req.activeRole)) {
      return res.status(403).json({ message: `يتطلب أحد الأدوار: ${roles.join(', ')}` });
    }
    return handler(req, res);
  });
}

/**
 * يقيّد المسار بطرق HTTP محددة فقط
 */
function withMethods(methods, handler) {
  return (req, res) => {
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return res.status(405).json({ message: `الطريقة ${req.method} غير مسموحة` });
    }
    return handler(req, res);
  };
}

module.exports = {
  withAuth,
  withManager,
  withManagerOrSupervisor,
  withActiveRole,
  withMethods,
};
