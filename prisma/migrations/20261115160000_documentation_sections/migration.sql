-- توثيق الدورة: إظهار أقسام المجلة والتقرير أو إخفاؤها
-- إضافة اختيارية؛ لا تمسّ بيانات قائمة، وتصلح لقاعدتي المعرّفات (نصّية أو UUID)
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "sections" JSONB;
