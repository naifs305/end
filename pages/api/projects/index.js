// =============================================================
// GET /api/projects
// -------------------------------------------------------------
// - بدون مصادقة: قائمة مبسطة (للتسجيل)
// - مع مصادقة مدير: قائمة تفصيلية (مشرفون، إحصائيات)
//
// POST /api/projects (للمدير فقط): إنشاء مشروع جديد
// =============================================================

const prisma = require('../../../lib/db/prisma');
const { getUserFromRequest } = require('../../../lib/auth/jwt');
const { withMethods, withManager } = require('../../../lib/middleware/auth');
const projectsService = require('../../../lib/services/projects');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // التحقق من وجود مصادقة
      const payload = getUserFromRequest(req);

      if (!payload) {
        // بدون مصادقة: قائمة مبسطة (للتسجيل)
        const list = await prisma.operationalProject.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
        return res.status(200).json(list);
      }

      // مع مصادقة: تحقق أنه مدير للوصول للتفاصيل
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { roles: true, isActive: true },
      });

      if (!user?.isActive) {
        // مصادقة غير صالحة، نرد بالقائمة المبسطة
        const list = await prisma.operationalProject.findMany({
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        });
        return res.status(200).json(list);
      }

      // للمدير: قائمة تفصيلية
      if (user.roles.includes('MANAGER')) {
        const projects = await projectsService.listProjects();
        return res.status(200).json(projects);
      }

      // لبقية المستخدمين: قائمة مبسطة
      const list = await prisma.operationalProject.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return res.status(200).json(list);
    }

    if (req.method === 'POST') {
      // محمي للمدير فقط
      return withManager(async (r, s) => {
        try {
          const project = await projectsService.createProject(r.body?.name, r.user.id);
          return s.status(201).json(project);
        } catch (err) {
          return s.status(err.statusCode || 500).json({ message: err.message });
        }
      })(req, res);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], handler);
module.exports.default = module.exports;
