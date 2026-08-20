// =============================================================
// طبقة الوصول للبيانات لوحدة الإعدادات (Repository)
// المكان الوحيد الذي يلمس prisma.translation / optionItem / appSetting ضمن هذه الوحدة.
// =============================================================
const prisma = require('../../db/prisma');

// ── الترجمات ─────────────────────────────────────────────────

function findTranslationKeys() {
  return prisma.translation.findMany({ select: { key: true, ar: true, en: true } });
}

function findAllTranslations() {
  return prisma.translation.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
}

function upsertTranslations(entries) {
  const ops = entries
    .filter((e) => e && e.key)
    .map((e) =>
      prisma.translation.upsert({
        where: { key: e.key },
        update: {
          ar: e.ar != null ? String(e.ar) : '',
          en: e.en != null ? String(e.en) : '',
          ...(e.category !== undefined ? { category: e.category } : {}),
        },
        create: {
          key: e.key,
          ar: e.ar != null ? String(e.ar) : '',
          en: e.en != null ? String(e.en) : '',
          category: e.category ?? e.key.split('.')[0],
        },
      })
    );
  return prisma.$transaction(ops);
}

// ── قوائم الخيارات ───────────────────────────────────────────

function findOptions(category) {
  return prisma.optionItem.findMany({
    where: { ...(category ? { category } : {}), isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { labelAr: 'asc' }],
  });
}

function findAllOptions() {
  return prisma.optionItem.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });
}

function createOption(data) {
  return prisma.optionItem.create({
    data: {
      category: data.category,
      value: data.value,
      labelAr: data.labelAr,
      labelEn: data.labelEn,
      sortOrder: Number(data.sortOrder) || 0,
      isActive: data.isActive !== false,
    },
  });
}

function updateOption(id, data) {
  const patch = {};
  for (const k of ['category', 'value', 'labelAr', 'labelEn']) {
    if (data[k] !== undefined) patch[k] = data[k];
  }
  if (data.sortOrder !== undefined) patch.sortOrder = Number(data.sortOrder) || 0;
  if (data.isActive !== undefined) patch.isActive = !!data.isActive;
  return prisma.optionItem.update({ where: { id }, data: patch });
}

function deleteOption(id) {
  return prisma.optionItem.delete({ where: { id } });
}

// ── إعدادات النظام ───────────────────────────────────────────

function findAllSettings() {
  return prisma.appSetting.findMany();
}

function findSetting(key) {
  return prisma.appSetting.findUnique({ where: { key } });
}

function upsertSettings(entries) {
  const ops = entries
    .filter((e) => e && e.key)
    .map((e) =>
      prisma.appSetting.upsert({
        where: { key: e.key },
        update: { value: String(e.value ?? '') },
        create: { key: e.key, value: String(e.value ?? ''), category: e.category ?? null, label: e.label ?? null },
      })
    );
  return prisma.$transaction(ops);
}

module.exports = {
  findTranslationKeys,
  findAllTranslations,
  upsertTranslations,
  findOptions,
  findAllOptions,
  createOption,
  updateOption,
  deleteOption,
  findAllSettings,
  findSetting,
  upsertSettings,
};
