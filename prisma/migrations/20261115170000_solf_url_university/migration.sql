-- رابط منصة السلف: المعتمدة الآن على خادم الجامعة لا القديمة على Vercel
-- يُحدَّث الإعداد إن كان ما يزال على العنوان القديم فقط؛ وأي قيمة غيّرها المدير تبقى كما هي
UPDATE "AppSetting"
SET "value" = 'https://solf-training.nauss.edu.sa', "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'solf.url' AND "value" = 'https://solf-nif.vercel.app';
