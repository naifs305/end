// =============================================================
// مخطّطات التحقّق (zod) لوحدة الإعدادات
// =============================================================
const { z } = require('zod');

const nonEmpty = (msg) => z.string({ required_error: msg }).trim().min(1, msg);

// إنشاء خيار: الحقول الأربعة مطلوبة (تطابق الحارس القديم).
const optionCreateSchema = z.object({
  category: nonEmpty('الحقول category و value و labelAr و labelEn مطلوبة'),
  value: nonEmpty('الحقول category و value و labelAr و labelEn مطلوبة'),
  labelAr: nonEmpty('الحقول category و value و labelAr و labelEn مطلوبة'),
  labelEn: nonEmpty('الحقول category و value و labelAr و labelEn مطلوبة'),
  sortOrder: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
});

// تعديل خيار: كل الحقول اختيارية (التحديث الجزئي يتم في المستودع).
const optionUpdateSchema = z.object({
  category: z.string().optional(),
  value: z.string().optional(),
  labelAr: z.string().optional(),
  labelEn: z.string().optional(),
  sortOrder: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
});

// مُعالِج مُسبَق يقبل إمّا مصفوفة مباشرة أو { entries: [...] }
// ويعيد دائماً مصفوفة غير فارغة، وإلا يفشل التحقّق (400).
function bulkEntries(requiredMessage) {
  return z.preprocess(
    (input) => (Array.isArray(input) ? input : input && typeof input === 'object' ? input.entries : input),
    z.array(z.record(z.any()), { required_error: requiredMessage, invalid_type_error: requiredMessage }).min(1, requiredMessage)
  );
}

const translationsBulkSchema = bulkEntries('قائمة الترجمات مطلوبة');
const settingsBulkSchema = bulkEntries('قائمة الإعدادات مطلوبة');

module.exports = {
  optionCreateSchema,
  optionUpdateSchema,
  translationsBulkSchema,
  settingsBulkSchema,
};
