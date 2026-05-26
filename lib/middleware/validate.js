// مساعدات التحقق من صحة المدخلات

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9+\-\s]{7,20}$/;

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

function isValidMobile(value) {
  return typeof value === 'string' && MOBILE_RE.test(value.trim());
}

function isNonEmptyString(value, maxLen = 500) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLen;
}

function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

function isPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0;
}

/**
 * validateLogin — يتحقق من مدخلات تسجيل الدخول
 * يرجع { valid: boolean, message?: string }
 */
function validateLogin({ email, password }) {
  if (!email || !password) return { valid: false, message: 'البريد وكلمة المرور مطلوبان' };
  if (!isValidEmail(email)) return { valid: false, message: 'صيغة البريد الإلكتروني غير صحيحة' };
  if (String(password).length < 6) return { valid: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
  return { valid: true };
}

/**
 * validateRegister — يتحقق من مدخلات إنشاء حساب جديد
 */
function validateRegister({ firstName, lastName, email, mobileNumber, password, operationalProjectId, acceptTerms }) {
  if (!acceptTerms) return { valid: false, message: 'يجب الموافقة على شروط الاستخدام' };
  if (!isNonEmptyString(firstName, 100)) return { valid: false, message: 'الاسم الأول مطلوب (100 حرف كحد أقصى)' };
  if (!isNonEmptyString(lastName, 100)) return { valid: false, message: 'الاسم الأخير مطلوب (100 حرف كحد أقصى)' };
  if (!isValidEmail(email)) return { valid: false, message: 'صيغة البريد الإلكتروني غير صحيحة' };
  if (!isValidMobile(mobileNumber)) return { valid: false, message: 'رقم الجوال غير صحيح' };
  if (!password || String(password).length < 8) return { valid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' };
  }
  if (!operationalProjectId) return { valid: false, message: 'المشروع التشغيلي مطلوب' };
  return { valid: true };
}

/**
 * validateCourse — يتحقق من مدخلات إنشاء/تعديل دورة
 */
function validateCourse(body, isUpdate = false) {
    if (!isUpdate) {
    if (!isNonEmptyString(body.name, 200)) return { valid: false, message: 'اسم الدورة مطلوب (200 حرف كحد أقصى)' };
    if (!body.operationalProjectId) return { valid: false, message: 'المشروع التشغيلي مطلوب' };
    if (!isValidDate(body.startDate)) return { valid: false, message: 'تاريخ البدء غير صحيح' };
    if (!isValidDate(body.endDate)) return { valid: false, message: 'تاريخ الانتهاء غير صحيح' };
    if (new Date(body.endDate) < new Date(body.startDate)) {
      return { valid: false, message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' };
    }
  } else {
    if (body.name !== undefined && !isNonEmptyString(body.name, 200)) {
      return { valid: false, message: 'اسم الدورة لا يمكن أن يكون فارغاً' };
    }
    if (body.startDate !== undefined && !isValidDate(body.startDate)) {
      return { valid: false, message: 'تاريخ البدء غير صحيح' };
    }
    if (body.endDate !== undefined && !isValidDate(body.endDate)) {
      return { valid: false, message: 'تاريخ الانتهاء غير صحيح' };
    }
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return { valid: false, message: 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء' };
    }
    if (body.numTrainees !== undefined && !isPositiveInt(body.numTrainees)) {
      return { valid: false, message: 'عدد المتدربين يجب أن يكون رقماً صحيحاً موجباً' };
    }
  }
  return { valid: true };
}

/**
 * validateMessage — يتحقق من مدخلات الرسالة
 */
function validateMessage({ recipientIds, message, subject }) {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    return { valid: false, message: 'يجب اختيار مستلم واحد على الأقل' };
  }
  if (recipientIds.length > 50) {
    return { valid: false, message: 'لا يمكن إرسال رسالة لأكثر من 50 شخصاً دفعة واحدة' };
  }
  if (!isNonEmptyString(message, 5000)) {
    return { valid: false, message: 'نص الرسالة مطلوب (5000 حرف كحد أقصى)' };
  }
  if (subject !== undefined && String(subject).length > 200) {
    return { valid: false, message: 'عنوان الرسالة يجب ألا يتجاوز 200 حرف' };
  }
  return { valid: true };
}

/**
 * validatePasswordReset — يتحقق من كلمة المرور الجديدة
 */
function validatePasswordReset({ password }) {
  if (!password || String(password).length < 8) {
    return { valid: false, message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, message: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' };
  }
  return { valid: true };
}

/**
 * validateProject — يتحقق من مدخلات المشروع
 */
function validateProject({ name }) {
  if (!isNonEmptyString(name, 200)) return { valid: false, message: 'اسم المشروع مطلوب (200 حرف كحد أقصى)' };
  return { valid: true };
}

module.exports = {
  validateLogin,
  validateRegister,
  validateCourse,
  validateMessage,
  validatePasswordReset,
  validateProject,
  isValidEmail,
  isNonEmptyString,
  isValidDate,
  isPositiveInt,
};
