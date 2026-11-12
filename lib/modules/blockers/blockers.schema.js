// =============================================================
// مخطّطات التحقّق (zod) لوحدة بلاغات العوائق
// =============================================================
const { z } = require('zod');

const BLOCKER_REASONS = [
  'TRAINER_GRADES',
  'TRAINEE_NAMES',
  'INSURANCE_SUSPENDED',
  'FINANCE_PENDING',
  'BENEFICIARY_PENDING',
  'OTHER',
];

// الجهة المنتظَرة إلزامية ومسمّاة — لأن النشر المنسوب لجهة بالاسم
// هو الحارس على صدق البلاغ، لا اعتماد المُراجِع.
const raiseBlockerSchema = z.object({
  trackingId: z.string().min(1, 'العنصر مطلوب'),
  reason: z.enum(BLOCKER_REASONS, { errorMap: () => ({ message: 'سبب العائق غير صالح' }) }),
  awaitedParty: z
    .string()
    .trim()
    .min(3, 'يجب تسمية الجهة المنتظَرة')
    .max(120, 'اسم الجهة طويل'),
  details: z
    .string()
    .trim()
    .min(10, 'اكتب تفصيل العائق (10 أحرف على الأقل)')
    .max(600, 'التفصيل طويل'),
});

const resolveBlockerSchema = z.object({
  note: z.string().trim().max(600).optional(),
});

const cancelBlockerSchema = z.object({
  note: z.string().trim().max(600).optional(),
});

const decideBlockerSchema = z.object({
  approve: z.boolean({ required_error: 'القرار مطلوب' }),
  note: z.string().trim().max(600).optional(),
}).superRefine((b, ctx) => {
  if (b.approve === false && !b.note) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'سبب الرفض مطلوب',
      path: ['note'],
    });
  }
});

module.exports = {
  BLOCKER_REASONS,
  raiseBlockerSchema,
  resolveBlockerSchema,
  cancelBlockerSchema,
  decideBlockerSchema,
};
