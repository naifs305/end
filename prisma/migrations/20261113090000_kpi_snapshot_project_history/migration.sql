-- =============================================================
-- تثبيت مشروع المنسق على لقطة الأداء + استرجاع الأشهر الماضية
-- -------------------------------------------------------------
-- المشكلة: لقطة الأداء لم تكن تسجّل مشروع المنسق، فكل تقرير مشروع
-- — ولو لشهر مضى — كان يُبنى من انتماء المنسق اليوم. فنقل منسق بين
-- المشاريع كان ينقل معه تاريخه كله ويغيّر متوسطات المشاريع
-- وترتيبها بأثر رجعي.
--
-- هذا الملف يضيف عمود المشروع على اللقطة، ثم يسترجع الأشهر الماضية
-- من الدورات: الدورة تحفظ مشروعها ومنسقها وتواريخها، فدورات المنسق
-- في ذلك الشهر هي الدليل على المشروع الذي كان يعمل فيه فعلاً.
--
-- آمن لإعادة التشغيل، ولا يحذف بياناً ولا يغيّر قيمة قائمة، ولا
-- يحتاج إيقاف المنصة.
-- =============================================================

-- ── (١) عمود المشروع على لقطة الأداء ────────────────────────
ALTER TABLE "EmployeeKpiSnapshot"
  ADD COLUMN IF NOT EXISTS "operationalProjectId" TEXT;

-- ── (٢) الفهرس ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "EmployeeKpiSnapshot_periodType_periodLabel_operationalProje_idx"
  ON "EmployeeKpiSnapshot"("periodType", "periodLabel", "operationalProjectId");

-- ── (٣) الربط بجدول المشاريع ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EmployeeKpiSnapshot_operationalProjectId_fkey'
  ) THEN
    ALTER TABLE "EmployeeKpiSnapshot"
      ADD CONSTRAINT "EmployeeKpiSnapshot_operationalProjectId_fkey"
      FOREIGN KEY ("operationalProjectId") REFERENCES "OperationalProject"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── (٤) استرجاع الأشهر الماضية من الدورات ───────────────────
-- لكل لقطة لا مشروع عليها: المشروع صاحب أكثر دورات للمنسق ضمن نطاق
-- تلك الفترة. وعند التساوي يُرجَّح المعرّف الأصغر ترتيباً ليكون
-- الاستنتاج ثابتاً. ولو لم تكن له دورة في تلك الفترة فلا دليل،
-- فنرجع لانتمائه الحالي.
-- لا يمسّ لقطة سُجّل عليها مشروع، فتكراره لا يغيّر شيئاً.
UPDATE "EmployeeKpiSnapshot" s
SET "operationalProjectId" = COALESCE(
  (
    SELECT c."operationalProjectId"
      FROM "Course" c
     WHERE c."primaryEmployeeId" = s."userId"
       AND c."startDate" <= s."periodEnd"
       AND c."endDate"   >= s."periodStart"
     GROUP BY c."operationalProjectId"
     ORDER BY COUNT(*) DESC, c."operationalProjectId" ASC
     LIMIT 1
  ),
  (SELECT u."operationalProjectId" FROM "User" u WHERE u."id" = s."userId")
)
WHERE s."operationalProjectId" IS NULL;
