// GET /api/motivation/challenges  — التحدي الحالي
// POST /api/motivation/challenges — إنشاء تحدي جديد (مدير)
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

const now = new Date();
const currentLabel = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

async function handler(req, res) {
  if (req.method === 'GET') {
    const { periodLabel } = req.query;
    const label = periodLabel || currentLabel;

    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM "TeamChallenge" WHERE "periodLabel"=$1 LIMIT 1
    `, label);

    const challenge = rows[0] || null;
    if (!challenge) return res.status(200).json(null);

    // حساب التقدم الفعلي من KPI snapshots
    let currentValue = null;
    try {
      const snaps = await prisma.$queryRawUnsafe(`
        SELECT AVG("timelinessScore") AS avg_timeliness,
               AVG("qualityScore")    AS avg_quality,
               AVG("returnRate")      AS avg_returns,
               AVG("finalScore")      AS avg_final
        FROM "EmployeeKpiSnapshot"
        WHERE "periodLabel"=$1
      `, label);
      if (snaps[0]) {
        const s = snaps[0];
        const metric = challenge.targetMetric;
        if (metric === 'timeliness')      currentValue = parseFloat(s.avg_timeliness) || 0;
        else if (metric === 'quality')    currentValue = parseFloat(s.avg_quality) || 0;
        else if (metric === 'zero_returns') currentValue = 100 - (parseFloat(s.avg_returns) || 0);
        else if (metric === 'final_score') currentValue = parseFloat(s.avg_final) || 0;
        else currentValue = parseFloat(s.avg_final) || 0;
      }
    } catch {}

    return res.status(200).json({ ...challenge, currentValue });
  }

  // POST — مدير فقط
  if (req.activeRole !== 'MANAGER') {
    return res.status(403).json({ message: 'يتطلب صلاحية المدير' });
  }

  const { title, description, targetMetric, targetValue, periodLabel } = req.body || {};
  if (!title || !targetMetric || targetValue == null) {
    return res.status(400).json({ message: 'title و targetMetric و targetValue مطلوبة' });
  }

  const label = periodLabel || currentLabel;

  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "TeamChallenge" ("id","periodLabel","title","description","targetMetric","targetValue","status","achieved","createdById","createdAt","updatedAt")
      VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,$5,'ACTIVE',false,$6,NOW(),NOW())
      ON CONFLICT ("periodLabel") DO UPDATE SET
        "title"=$2,"description"=$3,"targetMetric"=$4,"targetValue"=$5,"updatedAt"=NOW()
    `, label, title, description || null, targetMetric, Number(targetValue), req.user.id);
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
