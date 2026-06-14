// PUT /api/motivation/ideas/[id] — تحديث الحالة (مدير) أو التأييد (support)
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const prisma = require('../../../../lib/db/prisma');

async function handler(req, res) {
  const { id } = req.query;
  const { action, status, reviewNotes } = req.body || {};

  if (action === 'support') {
    // تأييد مبادرة
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "IdeaSupport" ("id","ideaId","userId","createdAt")
        VALUES (gen_random_uuid()::TEXT,$1,$2,NOW())
      `, id, req.user.id);
      await prisma.$executeRawUnsafe(`
        UPDATE "ImprovementIdea" SET "supportCount"="supportCount"+1,"updatedAt"=NOW() WHERE id=$1
      `, id);
      return res.status(200).json({ ok: true, action: 'supported' });
    } catch {
      // إلغاء التأييد إذا كان موجوداً
      await prisma.$executeRawUnsafe(`DELETE FROM "IdeaSupport" WHERE "ideaId"=$1 AND "userId"=$2`, id, req.user.id);
      await prisma.$executeRawUnsafe(`
        UPDATE "ImprovementIdea" SET "supportCount"=GREATEST(0,"supportCount"-1),"updatedAt"=NOW() WHERE id=$1
      `, id);
      return res.status(200).json({ ok: true, action: 'unsupported' });
    }
  }

  // تحديث الحالة — مدير/مشرف فقط
  if (!['MANAGER', 'PROJECT_SUPERVISOR'].includes(req.activeRole)) {
    return res.status(403).json({ message: 'غير مصرح' });
  }
  if (!status) return res.status(400).json({ message: 'الحالة مطلوبة' });

  const validStatuses = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'IMPLEMENTED', 'REJECTED'];
  if (!validStatuses.includes(status)) return res.status(400).json({ message: 'حالة غير صحيحة' });

  const implementedAt = status === 'IMPLEMENTED' ? 'NOW()' : 'NULL';
  await prisma.$executeRawUnsafe(`
    UPDATE "ImprovementIdea"
    SET "status"=$1::\"IdeaStatus\",
        "reviewNotes"=$2,
        "reviewedById"=$3,
        "reviewedAt"=NOW(),
        "implementedAt"=${implementedAt},
        "updatedAt"=NOW()
    WHERE id=$4
  `, status, reviewNotes || null, req.user.id, id);

  // منح شارة مبدع عند التنفيذ
  if (status === 'IMPLEMENTED') {
    const idea = await prisma.$queryRawUnsafe(`SELECT "userId" FROM "ImprovementIdea" WHERE id=$1`, id);
    if (idea[0]) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "EmployeeBadge" ("id","userId","badgeType","note","awardedById","awardedAt")
        VALUES (gen_random_uuid()::TEXT,$1,'IDEA_CHAMPION',$2,$3,NOW())
      `, idea[0].userId, `مبادرة مُنفَّذة: ${id}`, req.user.id);
    }
  }

  return res.status(200).json({ ok: true });
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
