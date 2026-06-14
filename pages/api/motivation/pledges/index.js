// GET /api/motivation/pledges  — تعهد المستخدم الحالي
// POST /api/motivation/pledges — حفظ تعهد جديد
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

function currentLabel() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const { periodLabel, userId } = req.query;
    const label = periodLabel || currentLabel();
    const uid = (req.activeRole === 'MANAGER' && userId) ? userId : req.user.id;

    try {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT p.*, u."firstName", u."lastName"
        FROM "MonthlyPledge" p
        JOIN "User" u ON u.id = p."userId"
        WHERE p."userId"=$1 AND p."periodLabel"=$2
        LIMIT 1
      `, uid, label);
      return res.status(200).json(rows[0] || null);
    } catch {
      return res.status(200).json(null);
    }
  }

  // POST — حفظ/تحديث التعهد
  const { pledge1, pledge2, pledge3, periodLabel } = req.body || {};
  if (!pledge1?.trim()) return res.status(400).json({ message: 'التعهد الأول مطلوب' });

  const label = periodLabel || currentLabel();

  await prisma.$executeRawUnsafe(`
    INSERT INTO "MonthlyPledge" ("id","userId","periodLabel","pledge1","pledge2","pledge3","createdAt")
    VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,$5,NOW())
    ON CONFLICT ("userId","periodLabel") DO UPDATE SET
      "pledge1"=$3,"pledge2"=$4,"pledge3"=$5
  `, req.user.id, label, pledge1.trim(), pledge2?.trim() || null, pledge3?.trim() || null);

  return res.status(201).json({ ok: true });
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
