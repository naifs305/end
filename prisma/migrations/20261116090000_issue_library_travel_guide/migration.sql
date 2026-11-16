-- =============================================================
-- ١. قائمة الصعوبات المتنامية: ما يضيفه منسق يصير خياراً لمن بعده
-- ٢. موضع الصعوبة (الدولة والمدينة والمقر) وكيف تجاوزها المنسق
-- ٣. عنصر «دليل السفر التعريفي» الإلزامي
-- آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً، ويصلح لقاعدتي المعرّفات.
-- =============================================================

ALTER TABLE "DepartmentIssue" ADD COLUMN IF NOT EXISTS "resolution" TEXT;
ALTER TABLE "DepartmentIssue" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "DepartmentIssue" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "DepartmentIssue" ADD COLUMN IF NOT EXISTS "venue" TEXT;

DO $$
DECLARE
  t_user text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = '"User"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "IssueType" (
      "id"          %1$s NOT NULL,
      "department"  TEXT NOT NULL,
      "key"         TEXT NOT NULL,
      "label"       TEXT NOT NULL,
      "usageCount"  INTEGER NOT NULL DEFAULT 0,
      "isActive"    BOOLEAN NOT NULL DEFAULT true,
      "createdById" %1$s,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "IssueType_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_user);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "IssueType_key_key" ON "IssueType"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "IssueType_department_label_key" ON "IssueType"("department", "label");

-- ── دليل السفر التعريفي: إلزامي قبل بداية الدورة بأسبوع (والأقصى ٣ أيام) ──
INSERT INTO "ClosureElement" (
  "id", "key", "name", "isFormBased",
  "deadlineRefPoint", "deadlineIdealHours", "deadlineMaxHours", "isDeadlineWorkingDays",
  "elementType", "conditionField", "isActive", "isCustom"
)
SELECT 'b1c2d3e4-0006-4a1b-9c2d-3e4f50617286', 'travel_guide', 'دليل السفر التعريفي', true,
       'START', -168, -72, false,
       'MANDATORY', NULL, true, false
WHERE NOT EXISTS (SELECT 1 FROM "ClosureElement" WHERE "key" = 'travel_guide');

-- يُضاف للدورات التي لم تبدأ بعد (مرحلة الإعداد) فقط؛ وما بدأ أو انتهى لا يُحمَّل عنصراً جديداً بأثر رجعي
INSERT INTO "CourseClosureTracking" ("id", "courseId", "elementId", "status")
SELECT gen_random_uuid(), c."id", e."id",
       (CASE WHEN c."status" = 'PREPARATION' THEN 'NOT_STARTED' ELSE 'NOT_APPLICABLE' END)::"ElementStatus"
  FROM "Course" c
 CROSS JOIN "ClosureElement" e
 WHERE e."key" = 'travel_guide'
   AND c."status" NOT IN ('CLOSED', 'ARCHIVED')
   AND NOT EXISTS (SELECT 1 FROM "CourseClosureTracking" t WHERE t."courseId" = c."id" AND t."elementId" = e."id");

INSERT INTO "AppSetting" ("key", "value", "category", "label", "createdAt", "updatedAt")
VALUES
  ('travelGuide.request.email.to', 'OD@nauss.edu.sa', 'email', 'دليل السفر: مستلم طلب تصميم دليل جديد', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('travelGuide.request.email.cc', 'NAlshahrani@nauss.edu.sa', 'email', 'دليل السفر: نسخة طلب تصميم دليل جديد', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
