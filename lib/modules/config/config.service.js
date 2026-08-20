// =============================================================
// وحدة الإعدادات — حالات الاستخدام (Service)
// الترجمات + قوائم الخيارات + إعدادات النظام
// تنسّق بين المستودع (repo) والصلاحيات (policy) وسجل التدقيق.
// تتلقّى DTO مُتحقَّقاً منه + actor = { userId, activeRole }.
// =============================================================
const repo = require('./config.repo');
const policy = require('./config.policy');
const { logAudit } = require('../../services/audit');

// يضع قيمة في مسار منقّط داخل كائن متداخل: set(obj, "a.b.c", v)
function setDeep(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

// ── الترجمات ─────────────────────────────────────────────────

// يعيد القواميس المتداخلة لكل لغة: { ar: {...}, en: {...} }
async function getTranslationsNested() {
  const rows = await repo.findTranslationKeys();
  const ar = {};
  const en = {};
  for (const row of rows) {
    setDeep(ar, row.key, row.ar);
    setDeep(en, row.key, row.en);
  }
  return { ar, en };
}

async function listTranslations() {
  return repo.findAllTranslations();
}

// إدراج/تحديث مجموعة من الترجمات دفعة واحدة
async function bulkUpsertTranslations(entries, actor) {
  policy.assertCanManage(actor.activeRole);
  return repo.upsertTranslations(entries);
}

// ── قوائم الخيارات ───────────────────────────────────────────

async function listOptions(category) {
  return repo.findOptions(category);
}

async function listAllOptions() {
  return repo.findAllOptions();
}

async function createOption(dto, actor) {
  policy.assertCanManage(actor.activeRole);
  return repo.createOption(dto);
}

async function updateOption(id, dto, actor) {
  policy.assertCanManage(actor.activeRole);
  return repo.updateOption(id, dto);
}

async function deleteOption(id, actor) {
  policy.assertCanManage(actor.activeRole);
  return repo.deleteOption(id);
}

// ── إعدادات النظام ───────────────────────────────────────────

async function getSettingsMap() {
  const rows = await repo.findAllSettings();
  const map = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// قراءة من جهة الخادم — بلا صلاحيات (تُستخدم في تصدير التقارير).
async function getSetting(key, fallback = null) {
  const row = await repo.findSetting(key);
  return row ? row.value : fallback;
}

async function bulkUpsertSettings(entries, actor) {
  policy.assertCanManage(actor.activeRole);
  return repo.upsertSettings(entries);
}

module.exports = {
  getTranslationsNested,
  listTranslations,
  bulkUpsertTranslations,
  listOptions,
  listAllOptions,
  createOption,
  updateOption,
  deleteOption,
  getSettingsMap,
  getSetting,
  bulkUpsertSettings,
};
