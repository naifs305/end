// =============================================================
// بذرة طبقة الإعدادات المُدارة من قاعدة البيانات
// -------------------------------------------------------------
// تملأ جداول Translation و OptionItem و AppSetting.
// الترجمات تُشتق من ملفات JSON المجمّعة (lib/i18n/locales) لتصبح
// قاعدة البيانات هي المصدر، وتبقى ملفات JSON بذرة/احتياطياً.
//
// التشغيل:  node prisma/seed-config.js   (أو: npm run seed:config)
// آمن لإعادة التشغيل (upsert).
// =============================================================

const fs = require('fs');
const path = require('path');

// ── محمّل .env بسيط (لا توجد تبعية dotenv في المشروع) ──────────
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* تجاهل */
  }
})();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ar = require('../lib/i18n/locales/ar.json');
const en = require('../lib/i18n/locales/en.json');

// يحوّل قاموساً متداخلاً إلى أزواج مفتاح منقّط/قيمة
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

function getDeep(obj, dottedKey) {
  return dottedKey.split('.').reduce((acc, p) => (acc == null ? acc : acc[p]), obj);
}

// ── قوائم الخيارات الافتراضية ────────────────────────────────
const OPTIONS = [
  // نوع الدورة (يُستخدم في شروط العناصر: courseType=external)
  { category: 'COURSE_TYPE', value: 'internal', labelAr: 'داخلية', labelEn: 'Internal', sortOrder: 1 },
  { category: 'COURSE_TYPE', value: 'external', labelAr: 'خارجية', labelEn: 'External', sortOrder: 2 },

  // مقر التنفيذ (تتوافق قيمها مع منطق اشتقاق courseType في نماذج الدورات)
  { category: 'LOCATION_TYPE', value: 'INTERNAL', labelAr: 'داخلي', labelEn: 'Internal', sortOrder: 1 },
  { category: 'LOCATION_TYPE', value: 'EXTERNAL', labelAr: 'خارجي', labelEn: 'External', sortOrder: 2 },
  { category: 'LOCATION_TYPE', value: 'REMOTE', labelAr: 'عن بُعد', labelEn: 'Remote', sortOrder: 3 },

  // المدن
  { category: 'CITY', value: 'riyadh', labelAr: 'الرياض', labelEn: 'Riyadh', sortOrder: 1 },
  { category: 'CITY', value: 'jeddah', labelAr: 'جدة', labelEn: 'Jeddah', sortOrder: 2 },
  { category: 'CITY', value: 'makkah', labelAr: 'مكة المكرمة', labelEn: 'Makkah', sortOrder: 3 },
  { category: 'CITY', value: 'madinah', labelAr: 'المدينة المنورة', labelEn: 'Madinah', sortOrder: 4 },
  { category: 'CITY', value: 'dammam', labelAr: 'الدمام', labelEn: 'Dammam', sortOrder: 5 },
  { category: 'CITY', value: 'khobar', labelAr: 'الخبر', labelEn: 'Khobar', sortOrder: 6 },
  { category: 'CITY', value: 'abha', labelAr: 'أبها', labelEn: 'Abha', sortOrder: 7 },
  { category: 'CITY', value: 'tabuk', labelAr: 'تبوك', labelEn: 'Tabuk', sortOrder: 8 },
  { category: 'CITY', value: 'buraidah', labelAr: 'بريدة', labelEn: 'Buraidah', sortOrder: 9 },
  { category: 'CITY', value: 'taif', labelAr: 'الطائف', labelEn: 'Taif', sortOrder: 10 },
];

// ── إعدادات النظام (تستبدل القيم المكتوبة في الكود) ───────────
const SETTINGS = [
  { key: 'report.email.to', value: process.env.REPORT_EMAIL_TO || 'OD@NAUSS.EDU.SA', category: 'email', label: 'مستلم تقارير الإقفال (إلى)' },
  { key: 'report.email.cc', value: process.env.REPORT_EMAIL_CC || 'NALSHAHRANI@NAUSS.EDU.SA', category: 'email', label: 'نسخة إلى (CC)' },
  { key: 'email.from', value: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev', category: 'email', label: 'البريد المُرسِل' },
  { key: 'kpi.officialStart', value: process.env.OFFICIAL_KPI_START || '2026-06', category: 'kpi', label: 'بداية احتساب الأداء (YYYY-MM)' },
  { key: 'solf.url', value: process.env.NEXT_PUBLIC_SOLF_URL || 'https://solf-nif.vercel.app', category: 'integration', label: 'رابط منصة السلف' },
];

async function main() {
  // ── الترجمات ──
  const flatAr = flatten(ar);
  const entries = Object.keys(flatAr).map((key) => ({
    key,
    ar: String(flatAr[key]),
    en: getDeep(en, key) != null ? String(getDeep(en, key)) : String(flatAr[key]),
    category: key.split('.')[0],
  }));

  for (const e of entries) {
    await prisma.translation.upsert({
      where: { key: e.key },
      update: { ar: e.ar, en: e.en, category: e.category },
      create: e,
    });
  }
  console.log(`✓ الترجمات: ${entries.length} مفتاح`);

  // ── قوائم الخيارات ──
  for (const o of OPTIONS) {
    await prisma.optionItem.upsert({
      where: { category_value: { category: o.category, value: o.value } },
      update: { labelAr: o.labelAr, labelEn: o.labelEn, sortOrder: o.sortOrder, isActive: true },
      create: o,
    });
  }
  console.log(`✓ الخيارات: ${OPTIONS.length} عنصر`);

  // ── الإعدادات ──
  for (const s of SETTINGS) {
    await prisma.appSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category, label: s.label },
      create: s,
    });
  }
  console.log(`✓ الإعدادات: ${SETTINGS.length} مفتاح`);

  console.log('\nاكتملت بذرة الإعدادات المُدارة من قاعدة البيانات.');
}

main()
  .catch((e) => {
    console.error('فشلت بذرة الإعدادات:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
