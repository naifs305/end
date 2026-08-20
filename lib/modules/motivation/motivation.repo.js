// =============================================================
// طبقة الوصول للبيانات لوحدة التحفيز (Repository)
// المكان الوحيد الذي يلمس prisma ضمن هذه الوحدة.
// تُحتفظ استدعاءات $queryRawUnsafe/$executeRawUnsafe بمعاملاتها كما هي بالحرف،
// وتبقى مُعاملة (parameterized) — لا إقحام نصي.
// =============================================================
const prisma = require('../../db/prisma');

// ---------------------------------------------------------------
// الشارات (Badges)
// ---------------------------------------------------------------
function findBadges(userIdFilter) {
  // userId مُمرّر كمعامل ($1) بدل الإقحام النصي (يمنع حقن SQL)
  const params = [];
  const whereClause = userIdFilter ? 'WHERE b."userId" = $1' : '';
  if (userIdFilter) params.push(userIdFilter);
  return prisma.$queryRawUnsafe(
    `
        SELECT b.*, u."firstName", u."lastName",
               u2."firstName" AS "awarderFirst", u2."lastName" AS "awarderLast"
        FROM "EmployeeBadge" b
        JOIN "User" u ON u.id = b."userId"
        LEFT JOIN "User" u2 ON u2.id = b."awardedById"
        ${whereClause}
        ORDER BY b."awardedAt" DESC
        LIMIT 200
      `,
    ...params
  );
}

function insertBadge(userId, badgeType, periodLabel, note, awardedById) {
  return prisma.$executeRawUnsafe(`
      INSERT INTO "EmployeeBadge" ("id","userId","badgeType","periodLabel","note","awardedById","awardedAt")
      VALUES (gen_random_uuid()::TEXT,$1,$2::\"BadgeType\",$3,$4,$5,NOW())
    `, userId, badgeType, periodLabel || null, note || null, awardedById);
}

// ---------------------------------------------------------------
// التحديات (Challenges)
// ---------------------------------------------------------------
function findChallengeByLabel(label) {
  return prisma.$queryRawUnsafe(`
      SELECT * FROM "TeamChallenge" WHERE "periodLabel"=$1 LIMIT 1
    `, label);
}

function findKpiSnapshotAverages(label) {
  return prisma.$queryRawUnsafe(`
        SELECT AVG("timelinessScore") AS avg_timeliness,
               AVG("qualityScore")    AS avg_quality,
               AVG("returnRate")      AS avg_returns,
               AVG("finalScore")      AS avg_final
        FROM "EmployeeKpiSnapshot"
        WHERE "periodLabel"=$1
      `, label);
}

function upsertChallenge(label, title, description, targetMetric, targetValue, createdById) {
  return prisma.$executeRawUnsafe(`
      INSERT INTO "TeamChallenge" ("id","periodLabel","title","description","targetMetric","targetValue","status","achieved","createdById","createdAt","updatedAt")
      VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,$5,'ACTIVE',false,$6,NOW(),NOW())
      ON CONFLICT ("periodLabel") DO UPDATE SET
        "title"=$2,"description"=$3,"targetMetric"=$4,"targetValue"=$5,"updatedAt"=NOW()
    `, label, title, description || null, targetMetric, Number(targetValue), createdById);
}

// ---------------------------------------------------------------
// المبادرات (Ideas)
// ---------------------------------------------------------------
function findIdeas({ supportUserId, status, mine, mineUserId }) {
  // كل القيم مُمرّرة كمعاملات ($n) — لا إقحام نصي (يمنع حقن SQL)
  const params = [];
  let p = 0;
  const supportParam = `$${++p}`;
  params.push(supportUserId); // معامل iSupported

  const whereParts = [];
  if (status) {
    whereParts.push(`i."status" = $${++p}::"IdeaStatus"`);
    params.push(String(status));
  }
  if (mine === 'true') {
    whereParts.push(`i."userId" = $${++p}`);
    params.push(mineUserId);
  }
  const whereClause = whereParts.length ? 'WHERE ' + whereParts.join(' AND ') : '';

  return prisma.$queryRawUnsafe(
    `
        SELECT i.*,
          u."firstName", u."lastName",
          u2."firstName" AS "reviewerFirst", u2."lastName" AS "reviewerLast",
          EXISTS(SELECT 1 FROM "IdeaSupport" s WHERE s."ideaId"=i.id AND s."userId"=${supportParam}) AS "iSupported"
        FROM "ImprovementIdea" i
        JOIN "User" u ON u.id = i."userId"
        LEFT JOIN "User" u2 ON u2.id = i."reviewedById"
        ${whereClause}
        ORDER BY i."supportCount" DESC, i."createdAt" DESC
        LIMIT 100
      `,
    ...params
  );
}

function insertIdea(userId, title, description, category) {
  return prisma.$executeRawUnsafe(`
    INSERT INTO "ImprovementIdea" ("id","userId","title","description","category","status","supportCount","createdAt","updatedAt")
    VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,'PENDING',0,NOW(),NOW())
  `, userId, title, description, category);
}

function insertIdeaSupport(ideaId, userId) {
  return prisma.$executeRawUnsafe(`
        INSERT INTO "IdeaSupport" ("id","ideaId","userId","createdAt")
        VALUES (gen_random_uuid()::TEXT,$1,$2,NOW())
      `, ideaId, userId);
}

function incrementIdeaSupportCount(ideaId) {
  return prisma.$executeRawUnsafe(`
        UPDATE "ImprovementIdea" SET "supportCount"="supportCount"+1,"updatedAt"=NOW() WHERE id=$1
      `, ideaId);
}

function deleteIdeaSupport(ideaId, userId) {
  return prisma.$executeRawUnsafe(`DELETE FROM "IdeaSupport" WHERE "ideaId"=$1 AND "userId"=$2`, ideaId, userId);
}

function decrementIdeaSupportCount(ideaId) {
  return prisma.$executeRawUnsafe(`
        UPDATE "ImprovementIdea" SET "supportCount"=GREATEST(0,"supportCount"-1),"updatedAt"=NOW() WHERE id=$1
      `, ideaId);
}

function updateIdeaStatus(status, reviewNotes, reviewedById, id, implementedAtExpr) {
  return prisma.$executeRawUnsafe(`
    UPDATE "ImprovementIdea"
    SET "status"=$1::\"IdeaStatus\",
        "reviewNotes"=$2,
        "reviewedById"=$3,
        "reviewedAt"=NOW(),
        "implementedAt"=${implementedAtExpr},
        "updatedAt"=NOW()
    WHERE id=$4
  `, status, reviewNotes || null, reviewedById, id);
}

function findIdeaOwner(id) {
  return prisma.$queryRawUnsafe(`SELECT "userId" FROM "ImprovementIdea" WHERE id=$1`, id);
}

function insertIdeaChampionBadge(userId, note, awardedById) {
  return prisma.$executeRawUnsafe(`
        INSERT INTO "EmployeeBadge" ("id","userId","badgeType","note","awardedById","awardedAt")
        VALUES (gen_random_uuid()::TEXT,$1,'IDEA_CHAMPION',$2,$3,NOW())
      `, userId, note, awardedById);
}

// ---------------------------------------------------------------
// التعهدات (Pledges)
// ---------------------------------------------------------------
function findPledge(uid, label) {
  return prisma.$queryRawUnsafe(`
        SELECT p.*, u."firstName", u."lastName"
        FROM "MonthlyPledge" p
        JOIN "User" u ON u.id = p."userId"
        WHERE p."userId"=$1 AND p."periodLabel"=$2
        LIMIT 1
      `, uid, label);
}

function upsertPledge(userId, label, pledge1, pledge2, pledge3) {
  return prisma.$executeRawUnsafe(`
    INSERT INTO "MonthlyPledge" ("id","userId","periodLabel","pledge1","pledge2","pledge3","createdAt")
    VALUES (gen_random_uuid()::TEXT,$1,$2,$3,$4,$5,NOW())
    ON CONFLICT ("userId","periodLabel") DO UPDATE SET
      "pledge1"=$3,"pledge2"=$4,"pledge3"=$5
  `, userId, label, pledge1, pledge2, pledge3);
}

function evaluatePledge(fulfilled1, fulfilled2, fulfilled3, rate, pledgeId) {
  return prisma.$executeRawUnsafe(`
    UPDATE "MonthlyPledge"
    SET "fulfilled1"=$1,"fulfilled2"=$2,"fulfilled3"=$3,"fulfillRate"=$4,"evaluatedAt"=NOW()
    WHERE id=$5
  `, fulfilled1, fulfilled2, fulfilled3, rate, pledgeId);
}

function findPledgeOwner(pledgeId) {
  return prisma.$queryRawUnsafe(`SELECT "userId","periodLabel" FROM "MonthlyPledge" WHERE id=$1`, pledgeId);
}

function insertPledgeKeeperBadge(userId, periodLabel, awardedById) {
  return prisma.$executeRawUnsafe(`
        INSERT INTO "EmployeeBadge" ("id","userId","badgeType","periodLabel","awardedById","awardedAt")
        VALUES (gen_random_uuid()::TEXT,$1,'PLEDGE_KEEPER',$2,$3,NOW())
      `, userId, periodLabel, awardedById);
}

module.exports = {
  findBadges,
  insertBadge,
  findChallengeByLabel,
  findKpiSnapshotAverages,
  upsertChallenge,
  findIdeas,
  insertIdea,
  insertIdeaSupport,
  incrementIdeaSupportCount,
  deleteIdeaSupport,
  decrementIdeaSupportCount,
  updateIdeaStatus,
  findIdeaOwner,
  insertIdeaChampionBadge,
  findPledge,
  upsertPledge,
  evaluatePledge,
  findPledgeOwner,
  insertPledgeKeeperBadge,
};
