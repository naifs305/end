// =============================================================
// وحدة الهوية — حالات الاستخدام (Service)
// تنسّق بين المستودع (repo) والصلاحيات (policy) وسجل التدقيق والبريد.
// منطق المصادقة/التشفير منقول حرفياً من المسارات/الخدمات القديمة:
//   - bcrypt عبر lib/auth/jwt (hashPassword/verifyPassword)
//   - زيادة tokenVersion عند تغيير/إعادة تعيين كلمة المرور (H4)
//   - تدفّق resetToken النمطي عبر prisma
//   - منع تخمين الحسابات: forgotPassword يُرجع دائماً نجاحاً (200)
//   - عدم تضمين كلمة المرور في بريد الترحيب (H3)
// =============================================================
const crypto = require('crypto');
const repo = require('./identity.repo');
const policy = require('./identity.policy');
const { AppError } = require('../../shared/AppError');
const { hashPassword, verifyPassword, signToken, signMfaToken, verifyMfaToken } = require('../../auth/jwt');
const { logAudit } = require('../../services/audit');
const { isStrongPassword, isNonEmptyString, isValidMobile } = require('../../middleware/validate');
const email = require('../../email');
const ldap = require('../../ldap/auth');
const config = require('../config/config.service');

// ----------------------------------------------------------------
// مساعدات
// ----------------------------------------------------------------

function buildAuthResponse(user) {
  const token = signToken({
    sub: user.id,
    email: user.email,
    roles: user.roles,
    tokenVersion: user.tokenVersion,
  });

  return {
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      project: user.operationalProject,
    },
  };
}

// ----------------------------------------------------------------
// التحقق الثنائي عبر البريد (OTP)
// الإعدادات (AppSetting، يديرها المدير من الملف الشخصي):
//   auth.mfa.enabled — 'true' | 'false' (الافتراضي مُفعّل)
//   auth.mfa.from    — بريد مُرسِل رموز التحقق
// MFA_ENABLED=false في البيئة يعطّله قسراً (مخرج طوارئ إن تعطّل البريد).
// ----------------------------------------------------------------

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const DEFAULT_OTP_FROM = 'od@nauss.edu.sa';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MFA_INVALID = () =>
  AppError.unauthorized('انتهت جلسة التحقق — سجّل الدخول من جديد', 'serverErrors.auth.mfaSessionInvalid');

async function isMfaEnabled() {
  if (String(process.env.MFA_ENABLED || '').toLowerCase() === 'false') return false;
  const value = await config.getSetting('auth.mfa.enabled', 'true');
  return String(value).trim().toLowerCase() !== 'false';
}

async function getOtpSender() {
  const value = String((await config.getSetting('auth.mfa.from', '')) || '').trim();
  if (EMAIL_RE.test(value)) return value;
  return process.env.MFA_FROM_EMAIL || DEFAULT_OTP_FROM;
}

// HMAC مربوط بالمستخدم: تسريب قاعدة البيانات لا يكشف الرمز، ولا يصلح رمز لحساب آخر
function hashOtp(userId, code) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET).update(`${userId}:${code}`).digest('hex');
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

function maskEmail(address) {
  const [local, domain] = String(address).split('@');
  if (!domain) return address;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'•'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

async function issueOtp(user) {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  await repo.setLoginOtp(user.id, hashOtp(user.id, code), new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000));

  const result = await email.sendLoginOtp({
    to: user.email,
    firstName: user.firstName,
    code,
    minutes: OTP_TTL_MINUTES,
    fromAddress: await getOtpSender(),
  });

  // بلا Resend مُهيّأ: نطبع الرمز في التطوير فقط؛ في الإنتاج يُعدّ فشل إرسال
  if (result?.mock && process.env.NODE_ENV !== 'production') {
    console.log(`[MFA DEV] OTP for ${user.email}: ${code}`);
    return;
  }
  if (!result || result.mock) {
    await repo.clearLoginOtp(user.id);
    throw new AppError('تعذّر إرسال رمز التحقق — حاول لاحقاً', { code: 'serverErrors.auth.otpSendFailed', statusCode: 503 });
  }
}

function buildMfaChallenge(user) {
  return {
    mfaRequired: true,
    mfaToken: signMfaToken({ sub: user.id, tokenVersion: user.tokenVersion }),
    email: maskEmail(user.email),
    expiresInMinutes: OTP_TTL_MINUTES,
    resendCooldownSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  };
}

// بعد اجتياز كلمة المرور (محلياً أو عبر AD): إما جلسة مباشرة أو تحدٍّ ثنائي
async function completeLogin(user) {
  if (!(await isMfaEnabled())) return buildAuthResponse(user);
  await issueOtp(user);
  return buildMfaChallenge(user);
}

async function loadMfaUser(mfaToken) {
  const payload = verifyMfaToken(mfaToken);
  if (!payload?.sub) throw MFA_INVALID();

  const user = await repo.findByIdWithProject(payload.sub);
  if (!user || !user.isActive || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
    throw MFA_INVALID();
  }
  return user;
}

async function verifyLoginOtp({ mfaToken, code }) {
  const user = await loadMfaUser(mfaToken);

  if (!user.otpHash || !user.otpExpiry || new Date(user.otpExpiry).getTime() < Date.now()) {
    throw AppError.badRequest('انتهت صلاحية رمز التحقق — اطلب رمزاً جديداً', 'serverErrors.auth.otpExpired');
  }

  // نحجز المحاولة قبل المقارنة: الطلبات المتزامنة لا تتجاوز الحد
  if (!(await repo.reserveOtpAttempt(user.id, OTP_MAX_ATTEMPTS))) {
    await repo.clearLoginOtp(user.id);
    throw AppError.badRequest('تجاوزت عدد المحاولات المسموح — اطلب رمزاً جديداً', 'serverErrors.auth.otpTooManyAttempts');
  }

  const candidate = hashOtp(user.id, String(code).trim());
  if (!safeEqualHex(candidate, user.otpHash)) {
    throw AppError.badRequest('رمز التحقق غير صحيح', 'serverErrors.auth.otpInvalid');
  }

  if (!(await repo.consumeLoginOtp(user.id, user.otpHash))) {
    throw AppError.badRequest('انتهت صلاحية رمز التحقق — اطلب رمزاً جديداً', 'serverErrors.auth.otpExpired');
  }

  return buildAuthResponse(user);
}

async function resendLoginOtp({ mfaToken }) {
  const user = await loadMfaUser(mfaToken);

  // وقت الإرسال السابق = الانتهاء − مدة الصلاحية
  if (user.otpExpiry) {
    const sentAt = new Date(user.otpExpiry).getTime() - OTP_TTL_MINUTES * 60 * 1000;
    if (Date.now() - sentAt < OTP_RESEND_COOLDOWN_MS) {
      throw new AppError('يرجى الانتظار قليلاً قبل طلب رمز جديد', { code: 'serverErrors.auth.otpResendTooSoon', statusCode: 429 });
    }
  }

  await issueOtp(user);
  return buildMfaChallenge(user);
}

// ----------------------------------------------------------------
// المصادقة
// ----------------------------------------------------------------

async function login({ email: emailInput, password }) {
  const trimmedEmail = String(emailInput).trim();

  // ── (١) Active Directory أولاً — إن كان مُهيّأً؛ وإلا يُرجع null فوراً ──
  const ldapUser = await ldap.ldapAuthenticate(trimmedEmail, password);
  if (ldapUser) {
    const directoryEmail = (ldapUser.email || `${ldapUser.username}@nauss.edu.sa`).toLowerCase();

    // قائمة المصرَّح لهم: نجاح المصادقة في AD وحده لا يمنح الدخول،
    // ولا يُنشئ حساباً. لا يدخل إلا من أضافه المدير مسبقاً.
    const existing = await repo.findByEmailInsensitive(directoryEmail, { includeProject: true });
    if (!existing || !existing.isActive) {
      throw AppError.unauthorized('بيانات الدخول غير صحيحة', 'serverErrors.auth.invalidCredentials');
    }

    // لا نمسّ passwordHash ولا roles ولا isActive — التعطيل المحلي يعلو على AD
    const nameUpdate = {};
    if (ldapUser.firstName && ldapUser.firstName !== existing.firstName) nameUpdate.firstName = ldapUser.firstName;
    if (ldapUser.lastName && ldapUser.lastName !== existing.lastName) nameUpdate.lastName = ldapUser.lastName;
    if (Object.keys(nameUpdate).length) {
      await repo.updateUserRaw(existing.id, nameUpdate);
      Object.assign(existing, nameUpdate);
    }

    return completeLogin(existing);
  }

  // ── (٢) الرجوع لكلمة المرور المحلية ──────────────────────────
  const user = await repo.findByEmailInsensitive(trimmedEmail, { includeProject: true });

  if (!user || !user.isActive) {
    throw AppError.unauthorized('بيانات الدخول غير صحيحة', 'serverErrors.auth.invalidCredentials');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('بيانات الدخول غير صحيحة', 'serverErrors.auth.invalidCredentials');
  }

  return completeLogin(user);
}

async function register(dto) {
  const { firstName, lastName, email: emailInput, mobileNumber, extensionNumber, password, operationalProjectId } = dto;

  const normalizedEmail = String(emailInput).trim().toLowerCase();

  // --- التحقق من عدم التكرار ---
  const existing = await repo.findByEmailInsensitive(normalizedEmail);
  if (existing) {
    throw AppError.badRequest('البريد الإلكتروني مستخدم مسبقاً', 'serverErrors.auth.emailAlreadyUsed');
  }

  // --- إنشاء المستخدم ---
  const passwordHash = await hashPassword(password);

  const user = await repo.createUser({
    email: normalizedEmail,
    passwordHash,
    firstName,
    lastName,
    mobileNumber,
    extensionNumber: extensionNumber || null,
    operationalProjectId,
    roles: ['EMPLOYEE'],
    termsAccepted: true,
    termsAcceptedAt: new Date(),
  });

  // بريد ترحيب (H3: لا تتضمن كلمة المرور) — لا نوقف العملية إذا فشل
  try {
    const emailSvc = require('../../services/emailService');
    await emailSvc.sendWelcomeEmail({ userId: user.id });
  } catch {}

  return buildAuthResponse(user);
}

/**
 * إضافة موظف مصرَّح له بالدخول عبر Active Directory — المدير فقط.
 * يُنشأ الحساب بـ passwordHash = null لأن المصادقة تتم عبر LDAP حصراً
 * (انظر identity.service.login و lib/ldap/auth.js). لا يستدعي LDAP هنا؛
 * البيانات تأتي مما اختاره المدير من نتائج /api/admin/ad-search.
 */
async function createDirectoryUser(dto, actor) {
  // إنشاء المستخدم يمنح أدواراً — نفس بوابة تغيير الأدوار (المدير فقط)
  policy.assertCanChangeUserRoles(actor.activeRole);

  const normalizedEmail = String(dto.email).trim().toLowerCase();

  const existing = await repo.findByEmailInsensitive(normalizedEmail);
  if (existing) {
    throw AppError.badRequest('البريد الإلكتروني مستخدم مسبقاً', 'serverErrors.auth.emailAlreadyUsed');
  }

  const user = await repo.createUser({
    email: normalizedEmail,
    passwordHash: null,
    firstName: dto.firstName,
    lastName: dto.lastName,
    mobileNumber: dto.mobileNumber,
    extensionNumber: dto.extensionNumber || null,
    operationalProjectId: dto.operationalProjectId,
    roles: dto.roles,
    termsAccepted: true,
    termsAcceptedAt: new Date(),
  });

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber,
    extensionNumber: user.extensionNumber,
    roles: user.roles,
    isActive: user.isActive,
    operationalProject: user.operationalProject,
    isDirectoryAccount: true,
  };
}

async function refresh(userId) {
  const freshUser = await repo.findFreshForRefresh(userId);

  if (!freshUser || !freshUser.isActive) {
    throw AppError.forbidden('الحساب غير نشط', 'serverErrors.auth.accountInactive');
  }

  const access_token = signToken({
    sub: freshUser.id,
    email: freshUser.email,
    roles: freshUser.roles,
    tokenVersion: freshUser.tokenVersion,
  });
  return { access_token, user: freshUser };
}

// منع تخمين الحسابات: يُرجع دائماً نفس الرسالة (نجاح 200)
async function forgotPassword({ email: emailInput }) {
  if (!emailInput || !emailInput.trim()) {
    throw AppError.badRequest('البريد الإلكتروني مطلوب', 'serverErrors.auth.emailRequired');
  }

  const SUCCESS = { message: 'إذا كان الحساب موجوداً، ستصل رسالة خلال لحظات' };

  const user = await repo.findByEmailInsensitive(emailInput.trim());
  if (!user || !user.isActive) {
    return SUCCESS;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

  await repo.setResetToken(user.id, token, expiry);

  // إرسال البريد (لا نوقف العملية إذا فشل البريد)
  try {
    await email.sendPasswordReset({ to: user.email, firstName: user.firstName, resetToken: token });
  } catch (emailErr) {
    console.error('[forgot-password] email error:', emailErr?.message);
  }

  return SUCCESS;
}

async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw AppError.badRequest('البيانات مطلوبة', 'serverErrors.auth.resetDataRequired');
  }

  // نفس سياسة كلمة المرور الأصلية (validatePasswordReset) — تُرجع رمز validation
  const pw = isStrongPassword(password);
  if (!pw.valid) {
    throw AppError.badRequest(pw.message, 'serverErrors.common.validation');
  }

  const user = await repo.findByResetToken(token);
  if (!user || !user.isActive) {
    throw AppError.badRequest('الرابط غير صالح أو منتهي الصلاحية', 'serverErrors.auth.resetTokenInvalid');
  }

  const passwordHash = await hashPassword(password);
  // يمسح الرمز ويزيد tokenVersion (H4)
  await repo.resetPasswordByToken(user.id, passwordHash);

  return { message: 'تم تغيير كلمة المرور بنجاح — يمكنك تسجيل الدخول الآن' };
}

// تغيير كلمة مرور المستخدم الحالي — يتطلب كلمة المرور الحالية
async function changePassword({ currentPassword, newPassword }, actor) {
  if (!currentPassword) {
    throw AppError.badRequest('كلمة المرور الحالية مطلوبة', 'serverErrors.profile.currentPasswordRequired');
  }

  const pw = isStrongPassword(newPassword);
  if (!pw.valid) {
    throw AppError.badRequest(pw.message, 'serverErrors.common.validation');
  }

  const fullUser = await repo.findPasswordHash(actor.userId);

  const matches = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!matches) {
    throw AppError.badRequest('كلمة المرور الحالية غير صحيحة', 'serverErrors.profile.currentPasswordIncorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await repo.setPasswordBumpVersion(actor.userId, passwordHash); // H4

  return { message: 'تم تغيير كلمة المرور بنجاح' };
}

// ----------------------------------------------------------------
// المستخدمون (CRUD)
// ----------------------------------------------------------------

async function listUsers(actor, { page = 1, limit = 100 } = {}) {
  const { buildUsersWhere } = require('../../services/permissions');
  const where = await buildUsersWhere(actor.user, actor.activeRole);

  const safePage = Math.max(1, parseInt(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, parseInt(limit) || 100));
  const skip = (safePage - 1) * safeLimit;

  const [total, rawUsers] = await Promise.all([
    repo.countUsers(where),
    repo.findManyUsers(where, { skip, take: safeLimit }),
  ]);

  // حساب مرتبط بدليل AD: لا كلمة مرور محلية. لا نُخرج التجزئة نفسها إطلاقاً.
  const data = rawUsers.map(({ passwordHash, ...user }) => ({
    ...user,
    isDirectoryAccount: passwordHash === null,
  }));

  return { data, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
}

async function getUser(id, actor) {
  const targetUser = await repo.findByIdSelect(id);
  if (!targetUser) {
    throw AppError.notFound('المستخدم غير موجود', 'serverErrors.users.notFound');
  }

  await policy.assertCanViewUser(actor.user, actor.activeRole, targetUser);
  return targetUser;
}

async function updateUser(id, dto, actor) {
  const targetUser = await repo.findByIdSelect(id);
  if (!targetUser) {
    throw AppError.notFound('المستخدم غير موجود', 'serverErrors.users.notFound');
  }

  await policy.assertCanEditUserBasicInfo(actor.user, actor.activeRole, targetUser);

  // قائمة سماح صريحة (H9): المعلومات الأساسية فقط — منع التعيين الجماعي للحقول الحساسة
  const { USER_UPDATE_ALLOWLIST, USER_ADMIN_UPDATE_FIELDS } = require('./identity.schema');
  const data = {};
  for (const field of USER_UPDATE_ALLOWLIST) {
    if (dto[field] !== undefined) data[field] = dto[field];
  }

  // تغيير الأدوار له مساره المحمي الخاص (للمدير فقط)
  if (Array.isArray(dto.roles) && policy.canChangeUserRoles(actor.activeRole)) {
    data.roles = dto.roles;
  }

  // الحقول الإدارية (المشروع التشغيلي وحالة التفعيل): للمدير فقط، كالأدوار
  if (policy.canChangeUserRoles(actor.activeRole)) {
    for (const field of USER_ADMIN_UPDATE_FIELDS) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
  }

  return repo.updateUser(id, data);
}

async function deleteUser(id, actor) {
  // حذف الحسابات صلاحية المدير وحده، كتغيير الأدوار
  if (!policy.canChangeUserRoles(actor.activeRole)) {
    throw AppError.forbidden('غير مصرح بحذف الحسابات', 'serverErrors.common.forbidden');
  }

  if (id === actor.userId) {
    throw AppError.badRequest('لا يمكن حذف حسابك الخاص', 'serverErrors.users.cannotDeleteSelf');
  }

  const user = await repo.findByIdSelect(id, { id: true });
  if (!user) {
    throw AppError.notFound('المستخدم غير موجود', 'serverErrors.users.notFound');
  }

  const courseCount = await repo.countCoursesForPrimary(id);
  if (courseCount > 0) {
    await repo.deactivateUser(id);
    return { action: 'deactivated', message: `تم تعطيل الحساب (لا يزال لديه ${courseCount} دورة)` };
  }

  await repo.purgeUser(id);
  return { action: 'deleted', message: 'تم حذف الحساب نهائياً' };
}

// إعادة تعيين كلمة مرور مستخدم آخر (المدير/المشرف) — يزيد tokenVersion (H4)
async function adminResetPassword(id, { password }, actor) {
  const pw = isStrongPassword(password);
  if (!pw.valid) {
    throw AppError.badRequest(pw.message, 'serverErrors.common.validation');
  }

  const targetUser = await repo.findByIdSelect(id, { id: true, roles: true, operationalProjectId: true });
  if (!targetUser) {
    throw AppError.notFound('المستخدم غير موجود', 'serverErrors.users.notFound');
  }

  await policy.assertCanResetUserPassword(actor.user, actor.activeRole, targetUser);

  const passwordHash = await hashPassword(password);
  await repo.setPasswordBumpVersion(id, passwordHash); // H4

  return { message: 'تمت إعادة تعيين كلمة المرور' };
}

// ----------------------------------------------------------------
// الملف الشخصي
// ----------------------------------------------------------------

async function getMe(actor) {
  const user = actor.user;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    mobileNumber: user.mobileNumber,
    extensionNumber: user.extensionNumber,
    profileImage: user.profileImage,
    signatureImage: user.signatureImage,
    roles: user.roles,
    project: user.operationalProject,
    isActive: user.isActive,
  };
}

async function getProfile(actor) {
  return repo.findByIdSelect(actor.userId, repo.PROFILE_SELECT);
}

// أنواع الصور المسموحة وحد الحجم التقريبي (base64) — كما في المسار الأصلي
const ALLOWED_IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const MAX_IMAGE_LENGTH = 6 * 1024 * 1024; // ~6 ميجابايت من نص base64

function validateImageField(value, label) {
  if (value === null || value === undefined) return { valid: true };
  if (typeof value !== 'string' || !ALLOWED_IMAGE_RE.test(value)) {
    return { valid: false, message: `صيغة ${label} غير صحيحة (يجب أن تكون صورة PNG/JPG/WEBP/GIF)` };
  }
  if (value.length > MAX_IMAGE_LENGTH) {
    return { valid: false, message: `حجم ${label} كبير جداً` };
  }
  return { valid: true };
}

async function updateProfile(body, actor) {
  const data = {};

  if (body.firstName !== undefined) {
    if (!isNonEmptyString(body.firstName, 100)) {
      throw AppError.badRequest('الاسم الأول مطلوب (100 حرف كحد أقصى)', 'serverErrors.profile.firstNameInvalid');
    }
    data.firstName = body.firstName.trim();
  }

  if (body.lastName !== undefined) {
    if (!isNonEmptyString(body.lastName, 100)) {
      throw AppError.badRequest('الاسم الأخير مطلوب (100 حرف كحد أقصى)', 'serverErrors.profile.lastNameInvalid');
    }
    data.lastName = body.lastName.trim();
  }

  if (body.mobileNumber !== undefined) {
    if (!isValidMobile(body.mobileNumber)) {
      throw AppError.badRequest('رقم الجوال غير صحيح', 'serverErrors.profile.mobileInvalid');
    }
    data.mobileNumber = body.mobileNumber.trim();
  }

  if (body.extensionNumber !== undefined) {
    const ext = body.extensionNumber;
    if (ext !== null && (typeof ext !== 'string' || ext.length > 20)) {
      throw AppError.badRequest('التحويلة غير صحيحة', 'serverErrors.profile.extensionInvalid');
    }
    data.extensionNumber = ext === null ? null : ext.trim();
  }

  if (body.profileImage !== undefined) {
    const v = validateImageField(body.profileImage, 'الصورة الشخصية');
    if (!v.valid) throw AppError.badRequest(v.message, 'serverErrors.profile.imageInvalid');
    data.profileImage = body.profileImage;
  }

  if (body.signatureImage !== undefined) {
    const v = validateImageField(body.signatureImage, 'التوقيع الإلكتروني');
    if (!v.valid) throw AppError.badRequest(v.message, 'serverErrors.profile.imageInvalid');
    data.signatureImage = body.signatureImage;
  }

  // منع تمرير role/roles أو أي حقول حساسة أخرى بشكل صريح
  delete data.role;
  delete data.roles;
  delete data.passwordHash;
  delete data.email;
  delete data.isActive;
  delete data.operationalProjectId;

  if (Object.keys(data).length === 0) {
    throw AppError.badRequest('لا توجد بيانات لتحديثها', 'serverErrors.profile.noDataToUpdate');
  }

  return repo.updateUser(actor.userId, data, repo.PROFILE_SELECT);
}

// ----------------------------------------------------------------
// المشرفون (assign / unassign / list)
// ----------------------------------------------------------------

async function assignSupervisor({ userId, operationalProjectId }, actor) {
  const managerId = actor.userId;

  const [user, project] = await Promise.all([
    repo.findByIdSelect(userId, { id: true, roles: true }),
    repo.findProjectById(operationalProjectId),
  ]);

  // ملاحظة توافق: المسار القديم كان يردّ دائماً برمز serverErrors.common.serverError
  // مع رمز الحالة الصحيح (404/400)، فنحافظ على نفس حقل code ورمز الحالة بالضبط.
  if (!user) {
    throw AppError.notFound('المستخدم غير موجود', 'serverErrors.common.serverError');
  }
  if (!project) {
    throw AppError.notFound('المشروع غير موجود', 'serverErrors.common.serverError');
  }

  const existing = await repo.findSupervisorByUserId(userId);
  if (existing && existing.operationalProjectId !== operationalProjectId) {
    throw AppError.badRequest('المستخدم مشرف بالفعل على مشروع آخر', 'serverErrors.common.serverError');
  }

  const assignment = await repo.upsertSupervisor(userId, operationalProjectId, managerId);

  if (!user.roles.includes('PROJECT_SUPERVISOR')) {
    await repo.updateUserRaw(userId, { roles: { push: 'PROJECT_SUPERVISOR' } });
  }

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_ASSIGNED', {
    userId,
    operationalProjectId,
    projectName: project.name,
  });

  return assignment;
}

async function unassignSupervisor(userId, actor) {
  const managerId = actor.userId;

  const supervision = await repo.findSupervisorByUserId(userId, {
    include: { user: true, operationalProject: true },
  });

  if (!supervision) {
    // توافق: المسار القديم كان يردّ برمز serverErrors.common.serverError وحالة 404
    throw AppError.notFound('المستخدم ليس مشرف مشروع', 'serverErrors.common.serverError');
  }

  await repo.deleteSupervisor(userId);

  const nextRoles = (supervision.user.roles || []).filter((role) => role !== 'PROJECT_SUPERVISOR');
  await repo.updateUserRaw(userId, { roles: nextRoles });

  await logAudit(managerId, 'MANAGER', 'SUPERVISOR_UNASSIGNED', {
    userId,
    operationalProjectId: supervision.operationalProjectId,
    projectName: supervision.operationalProject.name,
  });

  return { success: true };
}

async function listSupervisors() {
  return repo.listSupervisors();
}

module.exports = {
  // المصادقة
  login,
  verifyLoginOtp,
  resendLoginOtp,
  register,
  refresh,
  forgotPassword,
  resetPassword,
  changePassword,
  // المستخدمون
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  adminResetPassword,
  createDirectoryUser,
  // الملف الشخصي
  getMe,
  getProfile,
  updateProfile,
  // المشرفون
  assignSupervisor,
  unassignSupervisor,
  listSupervisors,
};
