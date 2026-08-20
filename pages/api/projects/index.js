// GET  /api/projects  — قائمة المشاريع (مختصرة للعامة، كاملة للمدير)
// POST /api/projects  — إنشاء مشروع (مدير فقط)
const { withMethods, withManager, withValidation, ok, created, fail } = require('../../../lib/server/http');
const { getUserFromRequest } = require('../../../lib/auth/jwt');
const prisma = require('../../../lib/db/prisma');
const projects = require('../../../lib/modules/projects/projects.service');
const { createProjectSchema } = require('../../../lib/modules/projects/projects.schema');

async function handler(req, res) {
  if (req.method === 'POST') {
    return withManager(
      withValidation(createProjectSchema, async (r, s) => {
        try {
          const project = await projects.create(r.valid, { userId: r.user.id, activeRole: r.activeRole });
          return created(s, project);
        } catch (e) {
          return fail(s, e);
        }
      })
    )(req, res);
  }

  // GET — المدير يرى القائمة الكاملة، وغيره القائمة المختصرة (للعامة)
  try {
    const payload = getUserFromRequest(req);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { roles: true, isActive: true } });
      if (user?.isActive && user.roles.includes('MANAGER')) {
        return ok(res, await projects.list());
      }
    }
    return ok(res, await projects.publicList());
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], handler);
module.exports.default = module.exports;
