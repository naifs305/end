// =============================================================
// مخطّطات التحقّق (zod) لوحدة الدورات
// تعكس قواعد التحقّق القديمة (lib/middleware/validate.validateCourse)
// بنفس الرسائل، إضافةً إلى مدخلات الإجراءات الفرعية.
// =============================================================
const { z } = require('zod');

const isValidDate = (value) => {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

// مخطّط الإنشاء — يطابق فرع (!isUpdate) في validateCourse
const createCourseSchema = z
  .object({
    name: z
      .string({ required_error: 'اسم الدورة مطلوب (200 حرف كحد أقصى)' })
      .refine((v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 200, 'اسم الدورة مطلوب (200 حرف كحد أقصى)'),
    operationalProjectId: z.any().refine((v) => !!v, 'المشروع التشغيلي مطلوب'),
    startDate: z.any().refine(isValidDate, 'تاريخ البدء غير صحيح'),
    endDate: z.any().refine(isValidDate, 'تاريخ الانتهاء غير صحيح'),
  })
  .passthrough()
  .refine((b) => new Date(b.endDate) >= new Date(b.startDate), {
    message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء',
    path: ['endDate'],
  });

// مخطّط التعديل — يطابق فرع (isUpdate) في validateCourse (كل الحقول اختيارية)
const updateCourseSchema = z
  .object({})
  .passthrough()
  .superRefine((b, ctx) => {
    if (b.name !== undefined && !(typeof b.name === 'string' && b.name.trim().length > 0 && b.name.trim().length <= 200)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'اسم الدورة لا يمكن أن يكون فارغاً', path: ['name'] });
    }
    if (b.startDate !== undefined && !isValidDate(b.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ البدء غير صحيح', path: ['startDate'] });
    }
    if (b.endDate !== undefined && !isValidDate(b.endDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ الانتهاء غير صحيح', path: ['endDate'] });
    }
    if (b.startDate && b.endDate && new Date(b.endDate) < new Date(b.startDate)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء', path: ['endDate'] });
    }
    if (b.numTrainees !== undefined && !(Number.isInteger(Number(b.numTrainees)) && Number(b.numTrainees) >= 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'عدد المتدربين يجب أن يكون رقماً صحيحاً موجباً', path: ['numTrainees'] });
    }
  });

// التحقّق من reassign يتم في المعالِج للحفاظ على رمز الخطأ الدقيق
const reassignSchema = z.object({}).passthrough();

// التحقّق من toggle-element / toggle-report يتم داخل الخدمة للحفاظ على
// رموز الأخطاء الدقيقة؛ لذا نمرّر المدخلات كما هي.
const toggleElementSchema = z.object({}).passthrough();
const toggleReportSchema = z.object({}).passthrough();

const overrideElementSchema = z
  .object({
    trackingId: z.string().min(1).optional(),
    action: z.enum(['revert', 'exempt', 'restore']).optional(),
    reason: z.string().optional(),
  })
  .passthrough();

const optionalReportSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
  })
  .passthrough();

const notesReportSchema = z.object({}).passthrough();

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  reassignSchema,
  toggleElementSchema,
  toggleReportSchema,
  overrideElementSchema,
  optionalReportSchema,
  notesReportSchema,
};
