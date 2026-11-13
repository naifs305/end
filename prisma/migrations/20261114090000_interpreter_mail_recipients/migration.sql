-- =============================================================
-- وجهات رسائل مترجم الدورة
-- -------------------------------------------------------------
-- عقد المترجم يدور خارج المنصة: الإدارة القانونية تراجعه وتعتمده،
-- ثم الإدارة المالية تصرف بموجبه على دفعتين. فتُخرج المنصة
-- الرسائل جاهزة بوجهاتها، وتبقى الوجهات قابلة للتغيير من شاشة
-- «إعدادات التشغيل» بلا تعديل برمجي.
--
-- آمن لإعادة التشغيل، ولا يحذف بياناً ولا يغيّر قيمة قائمة.
-- =============================================================

INSERT INTO "AppSetting" ("key", "value", "category", "label", "createdAt", "updatedAt")
VALUES
  ('interpreter.legal.email.to', 'Legal@nauss.edu.sa', 'email',
   'مستلم رسالة مراجعة عقد المترجم (الإدارة القانونية)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.legal.email.cc', 'NAlshahrani@nauss.edu.sa', 'email',
   'نسخة رسالة الإدارة القانونية', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.finance.email.to', 'finance@nauss.edu.sa', 'email',
   'مستلم طلبات صرف مستحقات المترجم (الإدارة المالية)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('interpreter.finance.email.cc',
   'AAlaraj@nauss.edu.sa, SAlbayoumi@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlfaifi@nauss.edu.sa',
   'email', 'نسخة طلبات صرف مستحقات المترجم', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
