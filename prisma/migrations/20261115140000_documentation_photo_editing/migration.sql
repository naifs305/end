-- توثيق الدورة: تعديل الصور بلا مساس بالأصل، وصور الجلسات، ومقاس المجلة
-- إضافات اختيارية بقيم افتراضية؛ لا تمسّ بيانات قائمة، وتصلح لقاعدتي المعرّفات (نصّية أو UUID)
ALTER TABLE "DocumentationMedia"   ADD COLUMN IF NOT EXISTS "edit" JSONB;
ALTER TABLE "DocumentationSession" ADD COLUMN IF NOT EXISTS "photoIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CourseDocumentation"  ADD COLUMN IF NOT EXISTS "format" TEXT NOT NULL DEFAULT 'A4';
