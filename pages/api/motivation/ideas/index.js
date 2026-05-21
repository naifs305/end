// GET /api/motivation/ideas  — قائمة المبادرات
// POST /api/motivation/ideas — إضافة مبادرة
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

async function handler(req, res) {
  if (req.method === 'GET') {
    const { status, mine } = req.query;
    const whereParts = [];
    if (status) whereParts.push(`i."status" = '${status}'`);
    if (mine === 'true') whereParts.push(`i."userId" = '${req.user.id}'`);
    const whereClause = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

    try {
      const ideas = await prisma.$queryRawUnsafe(`
        SELECT i.*,
          u."firstName", u."lastName",
          u2."firstName" AS "reviewerFirst", u2."lastName" AS "reviewerLast",
          EXISTS(SELECT 1 FROM "IdeaSupport" s WHERE s."ideaId"=i.id AND s."userId"='${req.user.id}') AS "iSupported"
        FROM "ImprovementIdea" i
        JOIN "User" u ON u.id = i."userId"
        LEFT JOIN "User" u2 ON u2.id = i."reviewedById"
        ${whereClause}
        ORDER BY i."supportCount" DESC, i."createdAt" DESC
        LIMIT 100
      `);
      return res.status(200).json(ideas);
    } catch {
      return res.status(200).json([]);
    }
  }

  // POST
  const { title, description, category } = req.body || {};
  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ message: 'العنوان والوصف مطلوبان' });
  }
  await prisma.$executeRawUnsafe(`
    INSERT INTO "ImprovementIdea" ("id","userId","title","description","category","status","supportCount","createdAt","updatedAt")
    VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,'PENDING',0,NOW(),NOW())
  `, req.user.id, title.trim(), description.trim(), category || 'general');

  return res.status(201).json({ ok: true });
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
