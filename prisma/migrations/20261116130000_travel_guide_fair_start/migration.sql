-- =============================================================
-- دليل السفر التعريفي: لا يُطالَب به بأثر رجعي
-- -------------------------------------------------------------
-- أُضيف العنصر لكل دورة في مرحلة الإعداد، وبعضها فات موعده الأقصى
-- (قبل البداية بثلاثة أيام) قبل أن يوجد العنصر أصلاً. هذه تُعلَّم «غير
-- منطبق» ما دام العنصر لم يُقدَّم فيها، فلا يُحتسب على منسقيها تأخيراً.
-- آمن لإعادة التشغيل.
-- =============================================================
UPDATE "CourseClosureTracking" t
   SET "status" = 'NOT_APPLICABLE'
  FROM "ClosureElement" e, "Course" c
 WHERE t."elementId" = e."id"
   AND t."courseId" = c."id"
   AND e."key" = 'travel_guide'
   AND t."status" = 'NOT_STARTED'
   AND t."executionAt" IS NULL
   AND c."startDate" < CURRENT_TIMESTAMP + INTERVAL '3 days';
