// PUT /api/motivation/pledges/evaluate — تقييم التعهد (مدير)
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

async function handler(req, res) {
  if (req.activeRole !== 'MANAGER') {
    return res.status(403).json({ message: 'يتطلب صلاحية المدير' });
  }

  const { pledgeId, fulfilled1, fulfilled2, fulfilled3 } = req.body || {};
  if (!pledgeId) return res.status(400).json({ message: 'pledgeId مطلوب' });

  // حساب نسبة الوفاء
  const vals = [fulfilled1, fulfilled2, fulfilled3].filter(v => v !== null && v !== undefined);
  const fulfilled = vals.filter(Boolean).length;
  const rate = vals.length > 0 ? Math.round((fulfilled / vals.length) * 100) : null;

  await prisma.$executeRawUnsafe(`
    UPDATE "MonthlyPledge"
    SET "fulfilled1"=$1,"fulfilled2"=$2,"fulfilled3"=$3,"fulfillRate"=$4,"evaluatedAt"=NOW()
    WHERE id=$5
  `, fulfilled1 ?? null, fulfilled2 ?? null, fulfilled3 ?? null, rate, pledgeId);

  // شارة وفي إذا وفى بكل تعهداته
  if (rate === 100) {
    const pledge = await prisma.$queryRawUnsafe(`SELECT "userId","periodLabel" FROM "MonthlyPledge" WHERE id=$1`, pledgeId);
    if (pledge[0]) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "EmployeeBadge" ("id","userId","badgeType","periodLabel","awardedById","awardedAt")
        VALUES (gen_random_uuid()::TEXT,$1,'PLEDGE_KEEPER',$2,$3,NOW())
      `, pledge[0].userId, pledge[0].periodLabel, req.user.id);
    }
  }

  return res.status(200).json({ ok: true, fulfillRate: rate });
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
