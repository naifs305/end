// =============================================================
// مخطّطات التحقّق (zod) لوحدة الجدولة
// ملاحظة: التحقّق الأصلي كان داخل createJob/updateJob (مع رموز/رسائل محددة)،
// والخدمة تُبقيه كما هو للحفاظ على السلوك بالحرف؛ هذه المخطّطات اختيارية للاستخدام عند الحافة.
// =============================================================
const { z } = require('zod');

const createJobSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  intervalHours: z.coerce.number(),
  payload: z.any().optional().nullable(),
}).passthrough();

const updateJobSchema = z.object({
  name: z.string().optional(),
  intervalHours: z.coerce.number().optional(),
  payload: z.any().optional().nullable(),
  status: z.string().optional(),
}).passthrough();

module.exports = { createJobSchema, updateJobSchema };
