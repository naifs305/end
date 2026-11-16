-- =============================================================
-- مترجم الدورة — بياناته وعناصر الإقفال الأربعة
-- -------------------------------------------------------------
-- عنصر اختياري يحدده المنسق عند إضافة الدورة، ونوع التعاقد يحدد
-- المطلوب منه:
--   • بعقد    → عقد مترجم (قبل بداية البرنامج)
--   • بتحويل  → طلب صرف مستحقات بالبريد (بعد الانتهاء)
--   • بسلفة   → نموذج استحقاق (بعد الانتهاء)
-- ومع أي نوع منها: شهادة إنجاز الترجمة بعد انتهاء البرنامج.
--
-- آمن لإعادة التشغيل، ولا يحذف بياناً ولا يغيّر قيمة قائمة.
-- الدورات القائمة لا يتغيّر فيها شيء: العناصر الأربعة تصلها
-- «غير مطلوبة» لأن حقل المترجم فيها غير مفعّل.
-- =============================================================

-- ── (١) حقول المترجم على الدورة ─────────────────────────────
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "requiresInterpreter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "interpreterContractType" TEXT;

-- ── (٢) جدول بيانات المترجم ─────────────────────────────────
-- معرّفات الدورة والمستخدم UUID في قاعدة فيرسل ونصّية في قاعدة
-- خادم الجامعة، والربط يشترط تطابق النوعين — فيأخذ كل عمود يشير
-- إليها نوعه من جدوله وقت التطبيق.
DO $$
DECLARE
  t_user   text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"User"'::regclass AND attname = 'id');
  t_course text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"Course"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "CourseInterpreter" (
      "id" %1$s NOT NULL,
      "courseId" %2$s NOT NULL,
      "fullName" TEXT NOT NULL,
      "nationalId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "mobile" TEXT NOT NULL,
      "address" TEXT NOT NULL,
      "nationality" TEXT,
      "amount" DOUBLE PRECISION,
      "bankName" TEXT,
      "bankBranch" TEXT,
      "bankCountry" TEXT,
      "iban" TEXT,
      "notes" TEXT,
      "createdById" %1$s,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CourseInterpreter_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_user, t_course);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CourseInterpreter_courseId_key"
  ON "CourseInterpreter"("courseId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseInterpreter_courseId_fkey') THEN
    ALTER TABLE "CourseInterpreter"
      ADD CONSTRAINT "CourseInterpreter_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseInterpreter_createdById_fkey') THEN
    ALTER TABLE "CourseInterpreter"
      ADD CONSTRAINT "CourseInterpreter_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- احتياط: لو أُنشئ الجدول بنسخة أقدم من هذا الملف
ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "nationality" TEXT;
ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "bankBranch" TEXT;
ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "bankCountry" TEXT;
ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "iban" TEXT;

-- ── (٣) عناصر الإقفال الأربعة ───────────────────────────────
-- مواعيدها مطابقة لنظائرها: العقد كطلب السلفة (قبل البداية)،
-- والمستحقات والشهادة كمستحقات المدرب (بعد الانتهاء بأيام عمل).
-- وللمدير تعديل أي موعد منها من شاشة «عناصر الإقفال».
INSERT INTO "ClosureElement" (
  "id", "key", "name", "isFormBased",
  "deadlineRefPoint", "deadlineIdealHours", "deadlineMaxHours", "isDeadlineWorkingDays",
  "elementType", "conditionField", "isActive", "isCustom"
) VALUES
  ('b1c2d3e4-0001-4a1b-9c2d-3e4f50617281', 'interpreter_contract',
   'عقد مترجم الدورة', true,
   'START', -120, -72, true,
   'CONDITIONAL', 'interpreterContractType=CONTRACT', true, false),
  ('b1c2d3e4-0002-4a1b-9c2d-3e4f50617282', 'interpreter_transfer',
   'طلب صرف مستحقات المترجم (تحويل)', true,
   'END', 72, 120, true,
   'CONDITIONAL', 'interpreterContractType=TRANSFER', true, false),
  ('b1c2d3e4-0003-4a1b-9c2d-3e4f50617283', 'interpreter_advance',
   'نموذج استحقاق مترجم الدورة (سلفة)', true,
   'END', 72, 120, true,
   'CONDITIONAL', 'interpreterContractType=ADVANCE', true, false),
  ('b1c2d3e4-0004-4a1b-9c2d-3e4f50617284', 'interpreter_certificate',
   'شهادة إنجاز الترجمة', true,
   'END', 72, 120, true,
   'CONDITIONAL', 'requiresInterpreter', true, false)
ON CONFLICT ("key") DO NOTHING;

-- ── (٤) سجلات التتبع للدورات القائمة ────────────────────────
-- الدورات المفتوحة تحتاج سجلاً لكل عنصر حتى يعمل تفعيله لاحقاً
-- (تغيير شرط الدورة يُحدّث سجلاً موجوداً ولا يُنشئ سجلاً).
-- وكلها «غير مطلوبة» لأن حقل المترجم غير مفعّل في دورة قائمة.
INSERT INTO "CourseClosureTracking" ("id", "courseId", "elementId", "status")
SELECT gen_random_uuid(), c."id", e."id", 'NOT_APPLICABLE'::"ElementStatus"
  FROM "Course" c
 CROSS JOIN "ClosureElement" e
 WHERE e."key" IN ('interpreter_contract', 'interpreter_transfer',
                   'interpreter_advance', 'interpreter_certificate')
   AND c."status" NOT IN ('CLOSED', 'ARCHIVED')
   AND NOT EXISTS (
     SELECT 1 FROM "CourseClosureTracking" t
      WHERE t."courseId" = c."id" AND t."elementId" = e."id"
   );

-- ── (٥) جهة طلب صرف مستحقات المترجم ─────────────────────────
-- قابلة للتغيير من إعدادات المنصة دون تعديل كود.
INSERT INTO "AppSetting" ("key", "value", "category", "label", "createdAt", "updatedAt")
VALUES
  ('interpreter.transfer.email.to', 'AAlfaifi@nauss.edu.sa', 'email',
   'مستلم طلب صرف مستحقات المترجم (تحويل)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.contract.rep', 'عبد الرزاق عبد العزيز المرجان', 'interpreter',
   'ممثل الجامعة في عقد الترجمة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.contract.repTitle', 'وكيل الجامعة للتدريب', 'interpreter',
   'صفة ممثل الجامعة في عقد الترجمة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.contract.email', 't-aalmargan@nauss.edu.sa', 'interpreter',
   'البريد الإلكتروني في صدر عقد الترجمة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.contract.bufferDays', '2', 'interpreter',
   'أيام ما قبل الدورة وما بعدها في مدة عقد الترجمة', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
