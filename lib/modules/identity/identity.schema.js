// =============================================================
// مخطّطات التحقّق (zod) لوحدة الهوية
// تحافظ على نفس قواعد ورسائل التحقّق الأصلية (lib/middleware/validate).
// =============================================================
const { z } = require('zod');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9+\-\s]{7,20}$/;
const ALLOWED_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const MAX_IMAGE_LENGTH = 6 * 1024 * 1024; // ~6 ميجابايت من نص base64

// السياسة الموحدة لكلمات المرور: ٨ أحرف على الأقل وتحتوي على حروف وأرقام
const strongPassword = z
  .string({ required_error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  .refine((p) => /[A-Za-z]/.test(p) && /[0-9]/.test(p), 'كلمة المرور يجب أن تحتوي على حروف وأرقام');

const email = z
  .string()
  .refine((v) => typeof v === 'string' && EMAIL_RE.test(v.trim()), 'صيغة البريد الإلكتروني غير صحيحة');

const mobile = z
  .string()
  .refine((v) => typeof v === 'string' && MOBILE_RE.test(v.trim()), 'رقم الجوال غير صحيح');

const nonEmpty100 = (msg) =>
  z.string().refine((v) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 100, msg);

// -------- المصادقة --------

// تسجيل الدخول: كلمة المرور 6 أحرف على الأقل (السياسة الأصلية الأخف)
const loginSchema = z.object({
  email: z
    .string()
    .refine((v) => typeof v === 'string' && EMAIL_RE.test(v.trim()), 'صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

const registerSchema = z.object({
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'يجب الموافقة على شروط الاستخدام' }) }),
  firstName: nonEmpty100('الاسم الأول مطلوب (100 حرف كحد أقصى)'),
  lastName: nonEmpty100('الاسم الأخير مطلوب (100 حرف كحد أقصى)'),
  email,
  mobileNumber: mobile,
  password: strongPassword,
  operationalProjectId: z.string({ required_error: 'المشروع التشغيلي مطلوب' }).min(1, 'المشروع التشغيلي مطلوب'),
  extensionNumber: z.string().optional().nullable(),
});

// إعادة تعيين كلمة المرور عبر الرابط (token + password)
const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'البيانات مطلوبة' }).min(1, 'البيانات مطلوبة'),
  password: strongPassword,
});

// طلب رابط إعادة التعيين
const forgotPasswordSchema = z.object({
  email: z.string().refine((v) => typeof v === 'string' && v.trim().length > 0, 'البريد الإلكتروني مطلوب'),
});

// تغيير كلمة المرور للمستخدم الحالي
const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'كلمة المرور الحالية مطلوبة' }).min(1, 'كلمة المرور الحالية مطلوبة'),
  newPassword: strongPassword,
});

// إعادة تعيين كلمة مرور مستخدم آخر (من قبل المدير/المشرف)
const adminResetPasswordSchema = z.object({
  password: strongPassword,
});

// -------- تحديث المستخدم (قائمة سماح H9) --------
// الحقول الأساسية فقط + roles (يُسمح بها للمدير في الخدمة).
const USER_UPDATE_ALLOWLIST = ['firstName', 'lastName', 'mobileNumber', 'extensionNumber', 'profileImage', 'signatureImage'];

const userUpdateSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    mobileNumber: z.string().optional(),
    extensionNumber: z.string().nullable().optional(),
    profileImage: z.string().nullable().optional(),
    signatureImage: z.string().nullable().optional(),
    roles: z.array(z.string()).optional(),
  })
  // نمرر الحقول غير المعروفة دون رفض، لكنها لن تصل لقاعدة البيانات (الخدمة تطبق قائمة السماح).
  .passthrough();

// -------- تحديث الملف الشخصي --------

function imageRefine(label) {
  return (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value !== 'string' || !ALLOWED_IMAGE_RE.test(value)) return false;
    if (value.length > MAX_IMAGE_LENGTH) return false;
    return true;
  };
}

const profileUpdateSchema = z
  .object({
    firstName: nonEmpty100('الاسم الأول مطلوب (100 حرف كحد أقصى)').optional(),
    lastName: nonEmpty100('الاسم الأخير مطلوب (100 حرف كحد أقصى)').optional(),
    mobileNumber: mobile.optional(),
    extensionNumber: z
      .union([z.string(), z.null()])
      .refine((v) => v === null || (typeof v === 'string' && v.length <= 20), 'التحويلة غير صحيحة')
      .optional(),
    profileImage: z
      .any()
      .refine(imageRefine('الصورة الشخصية'), 'صيغة الصورة الشخصية غير صحيحة (يجب أن تكون صورة PNG/JPG/WEBP/GIF)')
      .optional(),
    signatureImage: z
      .any()
      .refine(imageRefine('التوقيع الإلكتروني'), 'صيغة التوقيع الإلكتروني غير صحيحة (يجب أن تكون صورة PNG/JPG/WEBP/GIF)')
      .optional(),
  })
  .passthrough();

// -------- المشرفون --------

const assignSupervisorSchema = z.object({
  userId: z.string({ required_error: 'معرف المستخدم والمشروع مطلوبان' }).min(1, 'معرف المستخدم والمشروع مطلوبان'),
  operationalProjectId: z
    .string({ required_error: 'معرف المستخدم والمشروع مطلوبان' })
    .min(1, 'معرف المستخدم والمشروع مطلوبان'),
});

module.exports = {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
  userUpdateSchema,
  profileUpdateSchema,
  assignSupervisorSchema,
  USER_UPDATE_ALLOWLIST,
};
