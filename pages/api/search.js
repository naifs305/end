// GET /api/search?q=كلمة&types=courses,users
// بحث شامل عبر الدورات والمستخدمين
const prisma = require('../../lib/db/prisma');
const { withAuth, withMethods } = require('../../lib/middleware/auth');
const permissions = require('../../lib/services/permissions');

async function handler(req, res) {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) {
    return res.status(200).json({ courses: [], users: [], total: 0 });
  }

  const types = (req.query.types || 'courses,users').split(',').map(t => t.trim());
  const limit = Math.min(Number(req.query.limit || 10), 30);

  const courseWhere = await permissions.buildCoursesWhere(req.user, req.activeRole, {});
  const isManager   = req.activeRole === 'MANAGER';

  const results = await Promise.all([

    // ── الدورات ──────────────────────────────────────────────────────────
    types.includes('courses')
      ? prisma.course.findMany({
          where: {
            ...courseWhere,
            OR: [
              { name:              { contains: q, mode: 'insensitive' } },
              { code:              { contains: q, mode: 'insensitive' } },
              { beneficiaryEntity: { contains: q, mode: 'insensitive' } },
              { city:              { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true, name: true, code: true, status: true,
            startDate: true, endDate: true, courseType: true,
            beneficiaryEntity: true, city: true,
            operationalProject: { select: { name: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),

    // ── المستخدمون (مدير فقط) ─────────────────────────────────────────
    types.includes('users') && isManager
      ? prisma.user.findMany({
          where: {
            isActive: true,
            OR: [
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName:  { contains: q, mode: 'insensitive' } },
              { email:     { contains: q, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true, firstName: true, lastName: true,
            email: true, roles: true, isActive: true,
            operationalProject: { select: { name: true } },
          },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const [courses, users] = results;

  return res.status(200).json({
    courses,
    users,
    total: courses.length + users.length,
    query: q,
  });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
