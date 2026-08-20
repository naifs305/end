// =============================================================
// مخطّطات التحقّق (zod) لوحدة المراسلة
// تحاكي قواعد validateMessage الأصلية ورسائلها بالحرف نفسه.
// =============================================================
const { z } = require('zod');

const sendMessageSchema = z.object({
  recipientIds: z
    .array(z.any(), { required_error: 'يجب اختيار مستلم واحد على الأقل', invalid_type_error: 'يجب اختيار مستلم واحد على الأقل' })
    .min(1, 'يجب اختيار مستلم واحد على الأقل')
    .max(50, 'لا يمكن إرسال رسالة لأكثر من 50 شخصاً دفعة واحدة'),
  message: z
    .string({ required_error: 'نص الرسالة مطلوب (5000 حرف كحد أقصى)', invalid_type_error: 'نص الرسالة مطلوب (5000 حرف كحد أقصى)' })
    .trim()
    .min(1, 'نص الرسالة مطلوب (5000 حرف كحد أقصى)')
    .max(5000, 'نص الرسالة مطلوب (5000 حرف كحد أقصى)'),
  subject: z.string().max(200, 'عنوان الرسالة يجب ألا يتجاوز 200 حرف').optional(),
  courseId: z.string().optional().nullable(),
}).passthrough();

module.exports = { sendMessageSchema };
