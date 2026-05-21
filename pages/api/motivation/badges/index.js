// GET /api/motivation/badges — الشارات
// POST /api/motivation/badges — منح شارة (مدير فقط)
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query;
    const filter = req.activeRole === 'EMPLOYEE'
      ? { userId: req.user.id }
      : userId ? { userId } : {};

    const badges = await prisma.$queryRawUnsafe(`
      SELECT b.*, u."firstName", u."lastName", u2."firstName" AS "awarderFirst", u2."lastName" AS "awarderLast"
      FROM "EmployeeBadge" b
      JOIN "User" u ON u.id = b."userId"
      LEFT JOIN "User" u2 ON u2.id = b."awardedById"
      ${userId ? `WHERE b."userId" = '${userId.replace(/'/g,"''")}' ` : filter.userId ? `WHERE b."userId" = '${filter.userId.replace(/'/g,"''")}' ` : ''}
      ORDER BY b."awardedAt" DESC
      LIMIT 200
    `);
    return res.status(200).json(badges);
  }

  // POST — منح شارة يدوياً (مدير فقط)
  if (req.activeRole !== 'MANAGER') {
    return res.status(403).json({ message: 'يتطلب صلاحية المدير' });
  }
  const { userId, badgeType, periodLabel, note } = req.body || {};
  if (!userId || !badgeType) return res.status(400).json({ message: 'userId و badgeType مطلوبان' });

  await prisma.$executeRawUnsafe(`
    INSERT INTO "EmployeeBadge" ("id","userId","badgeType","periodLabel","note","awardedById","awardedAt")
    VALUES (gen_random_uuid()::TEXT,$1,$2::\"BadgeType\",$3,$4,$5,NOW())
  `, userId, badgeType, periodLabel || null, note || null, req.user.id);

  return res.status(201).json({ ok: true });
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
