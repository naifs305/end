-- اسم المنصة الجديد: «إتمام | منصة متابعة الدورات التدريبية»
-- نصوص الواجهة المحفوظة في القاعدة تُقدَّم على نصوص الملفات، فتُحدَّث هنا —
-- وما غيّره المدير بنفسه (أي قيمة غير الاسم القديم) يبقى كما هو.
UPDATE "Translation" SET "ar" = 'إتمام | منصة متابعة الدورات التدريبية', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'common.appName' AND "ar" = 'منصة إقفال الدورات التدريبية';
UPDATE "Translation" SET "en" = 'Itmam | Training Courses Follow-up Platform', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'common.appName' AND "en" = 'Training Course Closure Platform';
UPDATE "Translation" SET "ar" = 'إتمام', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'common.appNameShort' AND "ar" = 'إقفال الدورات';
UPDATE "Translation" SET "en" = 'Itmam', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'common.appNameShort' AND "en" = 'Course Closure';
UPDATE "Translation" SET "ar" = 'إتمام | منصة متابعة الدورات التدريبية', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'auth.systemTitle' AND "ar" = 'نظام إقفال الدورات التدريبية';
UPDATE "Translation" SET "en" = 'Itmam | Training Courses Follow-up Platform', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "key" = 'auth.systemTitle' AND "en" = 'Training Course Closure System';
