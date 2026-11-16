-- مهمة يومية: تذكير المنسق بإرسال شهادة إنجاز المترجم إلى الإدارة المالية
-- بعد انتهاء الدورة بثلاثة أيام (إشعار داخل المنصة، لا بريد). تُنشأ مفعّلة مرة واحدة.
INSERT INTO "ScheduledJob" ("id", "name", "type", "status", "intervalHours", "payload", "nextRunAt", "createdAt", "updatedAt")
SELECT
  -- معرّف ثابت بلا تحديد نوع، فيأخذ نوع العمود أياً كان (نصّياً أو UUID)
  'c4e8a2b6-3d71-4f09-9a5e-7b2d6c1f8e30',
  'تذكير شهادة إنجاز المترجم',
  'CUSTOM',
  'ACTIVE',
  24,
  '{"handler":"INTERPRETER_CERTIFICATE_REMINDER"}'::JSONB,
  CURRENT_TIMESTAMP + INTERVAL '1 hour',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ScheduledJob" WHERE "payload"->>'handler' = 'INTERPRETER_CERTIFICATE_REMINDER'
);
