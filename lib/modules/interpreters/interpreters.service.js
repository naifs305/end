// =============================================================
// سجل المترجمين
// -------------------------------------------------------------
// قاعدة واحدة للمترجمين: يختار منها المنسق مترجم دورته بدل أن
// يعيد إدخال بياناته، ويديرها المدير (إضافة وتعديل وحذف).
//
// ويدخلها تلقائياً كل مترجم جديد يسجّله منسق في دورة. والسجل
// يحفظ الثابت وحده (البيانات الشخصية والبنكية)؛ أما المتغيّر مع
// كل تعاقد (المبلغ والمدة والبرنامج) فمكانه بيانات الدورة.
//
// وبيانات مترجم الدورة نسخة مستقلة: تعديل السجل أو الحذف منه لا
// يغيّر عقداً وُقّع ولا مستنداً صدر.
// =============================================================
const repo = require('./interpreters.repo');
const { validate: validateCourseInterpreter } = require('../courses/interpreter.service');
const audit = require('../../services/audit');

// من يرى السجل: من ينفّذ عناصر الدورة أو يعتمدها. والجودة لا تحتاج
// الهويات والحسابات البنكية فلا تراها.
const VIEW_ROLES = ['MANAGER', 'EMPLOYEE', 'PROJECT_SUPERVISOR'];

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

function assertCanView(activeRole) {
  if (!VIEW_ROLES.includes(activeRole)) {
    throw httpError(403, 'غير مصرح لك بعرض سجل المترجمين', 'serverErrors.interpreters.viewForbidden');
  }
}

function assertManager(activeRole) {
  if (activeRole !== 'MANAGER') {
    throw httpError(403, 'إدارة سجل المترجمين للمدير وحده', 'serverErrors.interpreters.manageForbidden');
  }
}

/**
 * بيانات السجل: قواعد بيانات مترجم الدورة نفسها (الاسم رباعياً،
 * والهوية عشرة أرقام، والبريد والجوال والعنوان)، بلا المبلغ لأنه
 * يتغيّر مع كل تعاقد، ومعها التخصص.
 */
function validateProfile(dto) {
  const { amount, ...data } = validateCourseInterpreter({ ...dto, amount: null }); // eslint-disable-line no-unused-vars
  return { ...data, specialty: String(dto.specialty || '').trim() || null };
}

async function list(search, actor) {
  assertCanView(actor.activeRole);
  return repo.findAll(search);
}

async function create(dto, actor) {
  assertManager(actor.activeRole);
  const data = validateProfile(dto);
  if (await repo.findByNationalId(data.nationalId)) {
    throw httpError(409, 'هذا المترجم مسجّل من قبل بالهوية نفسها', 'serverErrors.interpreters.duplicate');
  }
  const saved = await repo.create(data, actor.userId);
  await audit.logAudit(actor.userId, actor.activeRole, 'INTERPRETER_DIRECTORY_ADDED', { interpreterName: saved.fullName });
  return saved;
}

async function update(id, dto, actor) {
  assertManager(actor.activeRole);
  const current = await repo.findById(id);
  if (!current) throw httpError(404, 'المترجم غير موجود', 'serverErrors.interpreters.notFound');

  const data = validateProfile(dto);
  if (data.nationalId !== current.nationalId) {
    const other = await repo.findByNationalId(data.nationalId);
    if (other && other.id !== id) {
      throw httpError(409, 'هذه الهوية مسجّلة لمترجم آخر', 'serverErrors.interpreters.duplicate');
    }
  }
  const saved = await repo.update(id, data);
  await audit.logAudit(actor.userId, actor.activeRole, 'INTERPRETER_DIRECTORY_UPDATED', { interpreterName: saved.fullName });
  return saved;
}

async function remove(id, actor) {
  assertManager(actor.activeRole);
  const current = await repo.findById(id);
  if (!current) throw httpError(404, 'المترجم غير موجود', 'serverErrors.interpreters.notFound');
  await repo.remove(id);
  await audit.logAudit(actor.userId, actor.activeRole, 'INTERPRETER_DIRECTORY_DELETED', { interpreterName: current.fullName });
  return { id };
}

/**
 * استيراد قائمة مترجمين من ملف (للمدير). الموجود بالهوية نفسها
 * يُحدَّث، والجديد يُضاف، وما لا يصح يُذكر سببه ولا يوقف البقية.
 */
async function importMany(items, actor) {
  assertManager(actor.activeRole);
  if (!Array.isArray(items) || items.length === 0) {
    throw httpError(400, 'الملف لا يحوي مترجمين', 'serverErrors.interpreters.importEmpty');
  }
  if (items.length > 500) {
    throw httpError(400, 'الملف أكبر من المسموح (500 مترجم)', 'serverErrors.interpreters.importTooLarge');
  }

  const result = { added: 0, updated: 0, failed: [] };
  for (const item of items) {
    try {
      const data = validateProfile(item || {});
      const existing = await repo.findByNationalId(data.nationalId);
      if (existing) {
        await repo.update(existing.id, data);
        result.updated += 1;
      } else {
        await repo.create(data, actor.userId);
        result.added += 1;
      }
    } catch (e) {
      result.failed.push({ name: String(item?.fullName || '—'), reason: e.message });
    }
  }
  await audit.logAudit(actor.userId, actor.activeRole, 'INTERPRETER_DIRECTORY_IMPORTED', {
    added: result.added, updated: result.updated, failed: result.failed.length,
  });
  return result;
}

/**
 * مترجم سجّله منسق في دورة: يدخل السجل إن كان جديداً، وإن كان
 * موجوداً تُكمَّل خاناته الفارغة دون أن يُكتب فوق ما أدخله المدير.
 * يُرجع معرّف المترجم في السجل لربط بيانات الدورة به.
 */
async function syncFromCourse(data, userId) {
  const existing = await repo.findByNationalId(data.nationalId);
  const profile = {
    fullName: data.fullName, nationalId: data.nationalId, nationality: data.nationality,
    email: data.email, mobile: data.mobile, address: data.address,
    bankName: data.bankName, bankBranch: data.bankBranch, bankCountry: data.bankCountry, iban: data.iban,
  };
  if (!existing) {
    const created = await repo.create(profile, userId);
    return created.id;
  }
  const fill = {};
  for (const [k, v] of Object.entries(profile)) {
    if (v && !existing[k]) fill[k] = v;
  }
  if (Object.keys(fill).length) await repo.update(existing.id, fill);
  return existing.id;
}

module.exports = { VIEW_ROLES, validateProfile, list, create, update, remove, importMany, syncFromCourse };
