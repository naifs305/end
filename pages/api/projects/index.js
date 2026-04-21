const prisma = require('../../../lib/db/prisma');
const { getUserFromRequest } = require('../../../lib/auth/jwt');
const { withMethods, withManager } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const payload = getUserFromRequest(req);

      if (!payload) {
        const list = await prisma.operationalProject.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
        return res.status(200).json(list);
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { roles: true, isActive: true },
      });

      if (user?.isActive && user.roles.includes('MANAGER')) {
        return res.status(200).json(await projectsService.listProjects());
      }

      const list = await prisma.operationalProject.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return res.status(200).json(list);
    }

    return withManager(async (r, s) => {
      const project = await projectsService.createProject(r.body?.name, r.user.id);
      return s.status(201).json(project);
    })(req, res);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET', 'POST'], handler);
module.exports.default = module.exports;
