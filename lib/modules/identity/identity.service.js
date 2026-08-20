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
const { hashPassword, verifyPassword, signToken } = require('../../auth/jwt');
const { logAudit } = require('../../services/audit');
const { isStrongPassword, isNonEmptyString, isValidMobile } = require('../../middleware/validate');
const email = require('../../email');

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
// المصادقة
// ----------------------------------------------------------------

async function login({ email: emailInput, password }) {
  const user = await repo.findByEmailInsensitive(String(emailInput).trim(), { includeProject: true });

  if (!user || !user.isActive) {
    throw AppError.unauthorized('بيانات الدخول غير صحيحة', 'serverErrors.auth.invalidCredentials');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('بيانات الدخول غير صحيحة', 'serverErrors.auth.invalidCredentials');
  }

  return buildAuthResponse(user);
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

  const [total, users] = await Promise.all([
    repo.countUsers(where),
    repo.findManyUsers(where, { skip, take: safeLimit }),
  ]);

  return { data: users, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
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
  const { USER_UPDATE_ALLOWLIST } = require('./identity.schema');
  const data = {};
  for (const field of USER_UPDATE_ALLOWLIST) {
    if (dto[field] !== undefined) data[field] = dto[field];
  }

  // تغيير الأدوار له مساره المحمي الخاص (للمدير فقط)
  if (Array.isArray(dto.roles) && policy.canChangeUserRoles(actor.activeRole)) {
    data.roles = dto.roles;
  }

  return repo.updateUser(id, data);
}

async function deleteUser(id, actor) {
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
  // الملف الشخصي
  getMe,
  getProfile,
  updateProfile,
  // المشرفون
  assignSupervisor,
  unassignSupervisor,
  listSupervisors,
};
