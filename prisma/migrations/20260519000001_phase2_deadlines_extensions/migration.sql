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
