const { getUserFromRequest, getActiveRole } = require('../auth/jwt');
const prisma = require('../db/prisma');
const {
  resolveActiveRole,
  getSupervisedProjectIds,
} = require('../services/permissions');

function withAuth(handler) {
  return async (req, res) => {
    try {
      const payload = getUserFromRequest(req);

      if (!payload?.sub) {
        return res.status(401).json({ message: 'غير مصادق' });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        include: { operationalProject: true },
      });

      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'الحساب غير موجود أو معطل' });
      }

      const activeRole = resolveActiveRole(user, getActiveRole(req));
      const supervisedProjectIds = activeRole === 'PROJECT_SUPERVISOR'
        ? await getSupervisedProjectIds(user.id)
        : [];

      req.user = user;
      req.activeRole = activeRole;
      req.scope = {
        supervisedProjectIds,
      };

      return handler(req, res);
    } catch (error) {
      console.error('withAuth error:', error);
      return res.status(500).json({ message: 'خطأ داخلي في التحقق من الهوية' });
    }
  };
}

function withManager(handler) {
  return withAuth(async (req, res) => {
    if (req.activeRole !== 'MANAGER') {
      return res.status(403).json({ message: 'يتطلب صلاحية المدير' });
    }

    return handler(req, res);
  });
}

function withManagerOrSupervisor(handler) {
  return withAuth(async (req, res) => {
    if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(req.activeRole)) {
      return res.status(403).json({ message: 'يتطلب صلاحية إدارية' });
    }

    return handler(req, res);
  });
}

function withActiveRole(allowedRoles, handler) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return withAuth(async (req, res) => {
    if (!roles.includes(req.activeRole)) {
      return res.status(403).json({ message: 'الدور النشط غير مصرح له' });
    }

    return handler(req, res);
  });
}

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
