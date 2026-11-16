-- توثيق الدورة: كلمة الترحيب، وعبارة الإشراف، وشعارات الشركاء، و«الإصدار المميّز» في مكتبة الإصدارات
-- إضافات اختيارية بقيم افتراضية؛ لا تمسّ بيانات قائمة، وتصلح لقاعدتي المعرّفات (نصّية أو UUID)
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "welcome" TEXT;
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "patronage" TEXT;
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "logos" JSONB;
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "CourseDocumentation_status_publishedAt_idx" ON "CourseDocumentation"("status", "publishedAt");
