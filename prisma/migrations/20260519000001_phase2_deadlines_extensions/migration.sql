-- المرحلة الثانية: مواعيد العناصر + التمديدات + الاستثناءات

-- ClosureElement: إضافة حقول المواعيد
ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineRefPoint"      TEXT;
ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineIdealHours"    INTEGER;
ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineMaxHours"      INTEGER;
ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "isDeadlineWorkingDays" BOOLEAN NOT NULL DEFAULT false;

-- Course: إضافة علامات الاختبار القبلي والبعدي
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "requiresPreTest"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "requiresPostTest" BOOLEAN NOT NULL DEFAULT false;

-- CourseClosureTracking: مبرر التأخر + التمديدات
ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "delayReason"          TEXT;
ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionGrantedAt"   TIMESTAMP(3);
ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionGrantedById" TEXT;
ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionHours"       INTEGER;
ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionReason"      TEXT;

-- Foreign key للتمديد (اختياري، لا يؤثر على الأداء لو لم يُفعَّل)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CourseClosureTracking_extensionGrantedById_fkey'
  ) THEN
    ALTER TABLE "CourseClosureTracking"
      ADD CONSTRAINT "CourseClosureTracking_extensionGrantedById_fkey"
      FOREIGN KEY ("extensionGrantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- تعبئة مواعيد عناصر الإقفال مباشرة في الترحيل
-- (موثوق أكثر من الـ seed — يُنفَّذ مرة واحدة تلقائياً)
UPDATE "ClosureElement" SET
  "deadlineRefPoint"='START', "deadlineIdealHours"=-72, "deadlineMaxHours"=-24, "isDeadlineWorkingDays"=false
WHERE key='trainee_registration';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='START', "deadlineIdealHours"=-48, "deadlineMaxHours"=0, "isDeadlineWorkingDays"=false
WHERE key='registration_message';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='START', "deadlineIdealHours"=-120, "deadlineMaxHours"=-72, "isDeadlineWorkingDays"=true
WHERE key='advance_req';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='START', "deadlineIdealHours"=0, "deadlineMaxHours"=24, "isDeadlineWorkingDays"=false
WHERE key='pre_test';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='START', "deadlineIdealHours"=0, "deadlineMaxHours"=24, "isDeadlineWorkingDays"=false
WHERE key='opening_report';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=0, "deadlineMaxHours"=24, "isDeadlineWorkingDays"=false
WHERE key='reaction_evaluation';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=0, "deadlineMaxHours"=24, "isDeadlineWorkingDays"=false
WHERE key='post_test';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=72, "deadlineMaxHours"=120, "isDeadlineWorkingDays"=true
WHERE key='certificates';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=24, "deadlineMaxHours"=72, "isDeadlineWorkingDays"=false
WHERE key='closing_report';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=72, "deadlineMaxHours"=120, "isDeadlineWorkingDays"=true
WHERE key='supervisor_compensation';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=72, "deadlineMaxHours"=120, "isDeadlineWorkingDays"=true
WHERE key='trainer_compensation';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=72, "deadlineMaxHours"=120, "isDeadlineWorkingDays"=false
WHERE key='revenues';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=24, "deadlineMaxHours"=72, "isDeadlineWorkingDays"=false
WHERE key='materials';

UPDATE "ClosureElement" SET
  "deadlineRefPoint"='END', "deadlineIdealHours"=120, "deadlineMaxHours"=240, "isDeadlineWorkingDays"=true
WHERE key='settlement';
