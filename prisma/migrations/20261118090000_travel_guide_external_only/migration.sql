-- =============================================================
-- دليل السفر التعريفي للدورات الخارجية وحدها
-- -------------------------------------------------------------
-- أُضيف العنصر إجبارياً لكل دورة، والدورة الداخلية لا سفر فيها ولا دليل.
-- صار مشروطاً بالدورة الخارجية (كالتأمين الطبي)، ويُعلَّم «غير منطبق» في
-- الدورات الداخلية ما دام لم يُقدَّم فيها. المقدَّم أو المعتمد يبقى كما هو.
-- آمن لإعادة التشغيل.
-- =============================================================
UPDATE "ClosureElement"
   SET "elementType" = 'CONDITIONAL',
       "conditionField" = 'courseType=external'
 WHERE "key" = 'travel_guide';

UPDATE "CourseClosureTracking" t
   SET "status" = 'NOT_APPLICABLE'
  FROM "ClosureElement" e, "Course" c
 WHERE t."elementId" = e."id"
   AND t."courseId" = c."id"
   AND e."key" = 'travel_guide'
   AND COALESCE(c."courseType", '') <> 'external'
   AND t."status" IN ('NOT_STARTED', 'RETURNED', 'REJECTED')
   AND t."executionAt" IS NULL;
