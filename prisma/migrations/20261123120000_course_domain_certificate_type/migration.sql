-- =============================================================
-- مجال الدورة ونوع شهادتها
-- -------------------------------------------------------------
-- • مجال الدورة (من مجالات المشاريع) يحدد مشروعها.
-- • نوع الشهادة: حضور أو اجتياز أو «بانتظار التحديد». الاجتياز
--   يستلزم الاختبار البعدي، والحضور لا اختبار فيه.
-- • عنصر «تأكيد نوع الشهادة» على المنسق حين يكون النوع بانتظار
--   التحديد: موعده إلى ما قبل إطلاق الشهادات (المثالي نهاية الدورة،
--   والأقصى بعدها بثلاثة أيام عمل = الموعد المثالي لإصدار الشهادات)،
--   فالدورة قد تُضاف قبل بدايتها بيومين. ولا تُقدَّم الشهادات قبله.
-- • بلاغ عائق جديد «بانتظار تحديد نوع الشهادة» يوقف ساعة العنصر
--   ويُنسب إلى إدارة تصميم البرامج التدريبية.
--
-- الدورات القائمة يبقى نوع شهادتها فارغاً، ولا يُفتح عليها العنصر:
-- كثير منها فات موعده، فلا يُحاسَب منسق على ما لم يكن مطلوباً.
-- آمن لإعادة التشغيل، والأنواع تؤخذ من الجداول المشار إليها.
-- =============================================================

DO $$ BEGIN
  EXECUTE format('ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "domainId" %s',
    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = '"ProjectDomain"'::regclass AND attname = 'id'));
END $$;

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateType" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateTypeConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateTypeChangedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateTypeResolvedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateTypeChangeCount" INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Course_domainId_fkey') THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_domainId_fkey"
      FOREIGN KEY ("domainId") REFERENCES "ProjectDomain"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- بلاغ العائق الجديد
ALTER TYPE "BlockerReason" ADD VALUE IF NOT EXISTS 'CERTIFICATE_TYPE_PENDING' BEFORE 'OTHER';

-- العنصر
INSERT INTO "ClosureElement" (
  "id", "key", "name", "isFormBased",
  "deadlineRefPoint", "deadlineIdealHours", "deadlineMaxHours", "isDeadlineWorkingDays",
  "elementType", "conditionField", "isActive", "isCustom"
)
SELECT 'c3d4e5f6-0007-4b2c-8d3e-4f5061728396', 'certificate_type', 'تأكيد نوع الشهادة', false,
       'END', 0, 72, true,
       'CONDITIONAL', 'certificateType=PENDING', true, false
WHERE NOT EXISTS (SELECT 1 FROM "ClosureElement" WHERE "key" = 'certificate_type');

-- يُضاف للدورات القائمة غير المقفلة «غير منطبق» (نوعها فارغ لا «بانتظار التحديد»)
INSERT INTO "CourseClosureTracking" ("id", "courseId", "elementId", "status")
SELECT gen_random_uuid(), c."id", e."id", 'NOT_APPLICABLE'::"ElementStatus"
  FROM "Course" c
 CROSS JOIN "ClosureElement" e
 WHERE e."key" = 'certificate_type'
   AND c."status" NOT IN ('CLOSED', 'ARCHIVED')
   AND NOT EXISTS (
     SELECT 1 FROM "CourseClosureTracking" t
      WHERE t."courseId" = c."id" AND t."elementId" = e."id"
   );
