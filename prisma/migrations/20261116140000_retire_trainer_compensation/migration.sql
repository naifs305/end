-- =============================================================
-- إيقاف عنصر «رفع مستحقات المدرب»: لم يعد من اختصاص المنسق
-- (ويختلف عن العنصر الاختياري «مدرب خارجي»).
-- لا يُحذف شيء: العنصر يُعطَّل فلا يُضاف لدورة جديدة، ويصير «غير منطبق» في
-- الدورات المفتوحة ما لم يُعتمد، والدورة التي لم يبقَ فيها غيره تُقفل.
-- والدورات المقفلة تبقى بسجلها كما هو. آمن لإعادة التشغيل.
-- =============================================================
UPDATE "ClosureElement" SET "isActive" = false WHERE "key" = 'trainer_compensation';

WITH changed AS (
  UPDATE "CourseClosureTracking" t
     SET "status" = 'NOT_APPLICABLE'
    FROM "ClosureElement" e, "Course" c
   WHERE t."elementId" = e."id"
     AND t."courseId" = c."id"
     AND e."key" = 'trainer_compensation'
     AND t."status" IN ('NOT_STARTED', 'RETURNED', 'REJECTED', 'PENDING_APPROVAL')
     AND c."status" IN ('PREPARATION', 'EXECUTION', 'AWAITING_CLOSURE')
  RETURNING t."courseId"
)
UPDATE "Course" c
   SET "status" = 'CLOSED', "closedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
 WHERE c."id" IN (SELECT "courseId" FROM changed)
   AND NOT EXISTS (
     SELECT 1 FROM "CourseClosureTracking" x
      WHERE x."courseId" = c."id"
        AND x."status" NOT IN ('APPROVED', 'NOT_APPLICABLE')
        AND x."elementId" NOT IN (SELECT "id" FROM "ClosureElement" WHERE "key" = 'trainer_compensation')
   );
