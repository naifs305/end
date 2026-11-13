// =============================================================
// بيانات مترجم الدورة
// -------------------------------------------------------------
// تُعبَّأ مرة واحدة لكل دورة، وتخدم مخرجات المترجم الأربعة:
// العقد، وطلب الصرف بالتحويل، ونموذج الاستحقاق بالسلفة، وشهادة
// إنجاز الترجمة. فلا يُعاد إدخال الاسم والهوية مع كل مستند، ولا
// يختلف الاسم بين مستند وآخر.
//
// بيانات الطرف الأول (الجامعة) ثابتة في قالب المستند لا هنا،
// وبيانات البرنامج (اسمه وتاريخه ومقر تنفيذه) تُقرأ من الدورة
// نفسها — فلا يُدخلها المنسق مرتين ولا يخطئ فيها.
// =============================================================
const repo = require('./courses.repo');
const permissions = require('../../services/permissions');
const { logAudit } = require('../../services/audit');

const CONTRACT_TYPES = ['CONTRACT', 'TRANSFER', 'ADVANCE'];

const CONTRACT_TYPE_LABELS = {
  CONTRACT: 'مترجم بعقد',
  TRANSFER: 'مترجم بتحويل',
  ADVANCE:  'مترجم بسلفة',
};

function badRequest(message, code) {
  const err = new Error(message);
  err.statusCode = 400;
  if (code) err.code = code;
  return err;
}

function notFound(message, code) {
  const err = new Error(message);
  err.statusCode = 404;
  if (code) err.code = code;
  return err;
}

function forbidden(message, code) {
  const err = new Error(message);
  err.statusCode = 403;
  if (code) err.code = code;
  return err;
}

/** تطبيع الأرقام العربية إلى إنجليزية — المنسق قد يكتب بلوحة عربية */
function normalizeDigits(value) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06F0 ? 0x06F0 : 0x0660;
    return String(code - base);
  });
}

/**
 * التحقق من بيانات المترجم.
 * الهوية والجوال يدخلان في مستند رسمي يُوقَّع، فلا نقبلهما ناقصين.
 */
function validate(dto) {
  const fullName = String(dto.fullName || '').trim();
  const nationalId = normalizeDigits(dto.nationalId).replace(/\D/g, '');
  const email = String(dto.email || '').trim().toLowerCase();
  const mobile = normalizeDigits(dto.mobile).replace(/[^\d+]/g, '');
  const address = String(dto.address || '').trim();

  // الاسم يُطبع في عقد ومستند رسمي، فالاسم المفرد لا يكفي.
  // نشترط ثلاثة مقاطع فأكثر — وهو ما يحقق الاسم الرباعي عملياً
  // دون التضييق على من يكتب «بن» مقطعاً مستقلاً.
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  if (nameParts.length < 3 || fullName.length < 8) {
    throw badRequest('اسم المترجم مطلوب رباعياً كما في الهوية', 'serverErrors.interpreter.nameRequired');
  }
  if (nationalId.length !== 10) {
    throw badRequest('رقم الهوية الوطنية يتكوّن من عشرة أرقام', 'serverErrors.interpreter.nationalIdInvalid');
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw badRequest('البريد الإلكتروني غير صحيح', 'serverErrors.interpreter.emailInvalid');
  }
  if (mobile.replace(/\D/g, '').length < 9) {
    throw badRequest('رقم الجوال غير صحيح', 'serverErrors.interpreter.mobileInvalid');
  }
  if (address.length < 4) {
    throw badRequest('عنوان المترجم مطلوب', 'serverErrors.interpreter.addressRequired');
  }

  const rawAmount = dto.amount === '' || dto.amount === null || dto.amount === undefined
    ? null
    : Number(normalizeDigits(dto.amount));

  if (rawAmount !== null && (!Number.isFinite(rawAmount) || rawAmount < 0)) {
    throw badRequest('قيمة المستحق غير صحيحة', 'serverErrors.interpreter.amountInvalid');
  }

  // رقم الحساب الدولي يُطبع في العقد وفي نموذج الاستحقاق، فإن كُتب
  // فليكن صحيح الشكل — ورقم ناقص في مستند مالي أسوأ من خانة فارغة.
  const iban = String(dto.iban || '').replace(/[\s-]/g, '').toUpperCase();
  if (iban && !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) {
    throw badRequest('رقم الحساب الدولي (IBAN) غير صحيح', 'serverErrors.interpreter.ibanInvalid');
  }

  return {
    fullName,
    nationalId,
    email,
    mobile,
    address,
    nationality: String(dto.nationality || '').trim() || null,
    amount: rawAmount,
    bankName: String(dto.bankName || '').trim() || null,
    bankBranch: String(dto.bankBranch || '').trim() || null,
    bankCountry: String(dto.bankCountry || '').trim() || null,
    iban: iban || null,
    notes: String(dto.notes || '').trim() || null,
  };
}

/**
 * ما ينقص لإصدار مستند معيّن.
 * المستند المالي بخانة حساب فارغة لا قيمة له، فنمنع إصداره ونقول
 * ما ينقص بدل أن نُخرج ورقة ناقصة تُرسل كما هي.
 */
function missingForDocument(elementKey, interpreter) {
  if (!interpreter) return ['بيانات المترجم'];

  const needsPayment = ['interpreter_contract', 'interpreter_transfer', 'interpreter_advance']
    .includes(elementKey);

  if (!needsPayment) return [];

  const missing = [];
  if (interpreter.amount === null || interpreter.amount === undefined) missing.push('قيمة المستحق');
  if (!interpreter.bankName) missing.push('اسم البنك');
  if (!interpreter.iban) missing.push('رقم الحساب الدولي (IBAN)');
  return missing;
}

/** قراءة بيانات المترجم مع ما تحتاجه المستندات من بيانات البرنامج */
async function getInterpreter(courseId, user, activeRole) {
  const course = await repo.findFullById(courseId);
  if (!course) throw notFound('الدورة غير موجودة', 'serverErrors.course.notFound');

  const canView = await permissions.canViewCourse(user, activeRole, course);
  if (!canView) throw forbidden('غير مصرح لك بعرض هذه الدورة', 'serverErrors.course.viewForbidden');

  const interpreter = await repo.findInterpreter(courseId);

  return {
    requiresInterpreter: !!course.requiresInterpreter,
    contractType: course.interpreterContractType || null,
    contractTypeLabel: CONTRACT_TYPE_LABELS[course.interpreterContractType] || null,
    interpreter: interpreter || null,
    isComplete: !!interpreter,
  };
}

/**
 * حفظ بيانات المترجم (إنشاء أو تعديل).
 * لا تُقبل على دورة بلا مترجم — فالبيانات بلا عنصر يستهلكها لا معنى لها.
 */
async function saveInterpreter(courseId, dto, user, activeRole) {
  const course = await repo.findByIdWithSupportingTeam(courseId);
  if (!course) throw notFound('الدورة غير موجودة', 'serverErrors.course.notFound');

  const check = await permissions.canEditCourse(user, activeRole, course);
  if (!check.allowed) {
    throw forbidden(check.reason || 'غير مصرح بتعديل هذه الدورة', 'serverErrors.course.editForbidden');
  }

  if (!course.requiresInterpreter) {
    throw badRequest(
      'هذه الدورة غير مُفعَّل فيها مترجم — فعّله من بيانات الدورة أولاً',
      'serverErrors.interpreter.notEnabled',
    );
  }

  const data = validate(dto);
  const existed = await repo.findInterpreter(courseId);

  const saved = await repo.upsertInterpreter(courseId, data, user.id);

  await logAudit(
    user.id,
    activeRole,
    existed ? 'INTERPRETER_DATA_UPDATED' : 'INTERPRETER_DATA_ADDED',
    { courseId, interpreterName: saved.fullName },
    courseId,
  );

  return saved;
}

module.exports = {
  CONTRACT_TYPES,
  CONTRACT_TYPE_LABELS,
  normalizeDigits,
  validate,
  missingForDocument,
  getInterpreter,
  saveInterpreter,
};
