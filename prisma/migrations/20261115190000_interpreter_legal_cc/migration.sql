-- نسخة رسالة الإدارة القانونية (عقد المترجم): يُضاف MAlsolami@nauss.edu.sa و OD@nauss.edu.sa
-- إلى العناوين المسجّلة، ويبقى ما سجّله المدير كما هو. آمن للتكرار: لا يُضاف عنوان موجود.
UPDATE "AppSetting"
SET "value" = CASE WHEN btrim("value") = '' THEN 'MAlsolami@nauss.edu.sa' ELSE "value" || ', MAlsolami@nauss.edu.sa' END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'interpreter.legal.email.cc' AND lower("value") NOT LIKE '%malsolami@nauss.edu.sa%';

UPDATE "AppSetting"
SET "value" = CASE WHEN btrim("value") = '' THEN 'OD@nauss.edu.sa' ELSE "value" || ', OD@nauss.edu.sa' END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'interpreter.legal.email.cc' AND lower("value") NOT LIKE '%od@nauss.edu.sa%';
