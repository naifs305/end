// =============================================================
// استيراد بيانات النظام القديم إلى قاعدة بيانات الجامعة (دفع)
// -------------------------------------------------------------
// يقرأ ملفات JSON التي أنتجها export-legacy.js ويكتبها في القاعدة
// المضبوطة في DATABASE_URL الحالي.
//
// • آمن لإعادة التشغيل: يستخدم upsert بالمعرّف الأصلي، فلا يكرر شيئاً.
// • يحافظ على المعرّفات الأصلية حتى تبقى الروابط بين الجداول سليمة.
// • المستخدمون: يُحدَّث المشروع والأدوار والحالة فقط، ولا تُمسّ كلمات
//   المرور ولا الحسابات القادمة من دليل الجامعة — المطابقة بالبريد.
//
// التشغيل:
//   node scripts/import-legacy.js --dry     معاينة دون كتابة
//   node scripts/import-legacy.js           تنفيذ فعلي
// =============================================================

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
if (!process.env.DATABASE_URL) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const IN = path.join('C:', 'nif', 'الملفات المساعدة', 'نقل البيانات');
const DRY = process.argv.includes('--dry');

// نفس ترتيب التصدير — المستقل قبل المرتبط
const ORDER = [
  ['operationalProject',       'المشاريع التشغيلية'],
  ['closureElement',           'عناصر الإقفال (التعريف)'],
  ['course',                   'الدورات'],
  ['courseSupport',            'الفريق المساند'],
  ['courseClosureTracking',    'متابعة إقفال الدورات'],
  ['courseOptionalReport',     'التقارير الاختيارية'],
  ['fieldReport',              'التقارير الميدانية'],
  ['courseAssignmentRegister', 'سجل إسناد الدورات'],
  ['employeeKpiSetting',       'إعدادات المؤشرات'],
  ['employeeKpiSnapshot',      'لقطات المؤشرات'],
  ['employeeKpiNote',          'ملاحظات المؤشرات'],
  ['employeeBadge',            'أوسمة الموظفين'],
  ['improvementIdea',          'أفكار التحسين'],
  ['ideaSupport',              'دعم الأفكار'],
  ['teamChallenge',            'تحديات الفريق'],
  ['monthlyPledge',            'التعهدات الشهرية'],
  ['message',                  'الرسائل'],
  ['messageRecipient',         'مستلمو الرسائل'],
  ['notification',             'الإشعارات'],
  ['auditLog',                 'سجل التدقيق'],
];

const read = (name) => {
  const f = path.join(IN, name + '.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

// حقول التاريخ تعود نصاً من JSON — Prisma يحتاجها Date
const DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const revive = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'string' && DATE_RE.test(v) ? new Date(v) : v;
  }
  return out;
};

async function importUsers() {
  const rows = read('user');
  if (!rows) { console.log('  لا يوجد ملف المستخدمين — تخطٍّ'); return; }

  let matched = 0, missing = [];
  for (const raw of rows) {
    const u = revive(raw);
    // المطابقة بالبريد: حسابات دليل الجامعة موجودة مسبقاً
    const existing = await prisma.user.findFirst({
      where: { email: { equals: u.email, mode: 'insensitive' } },
    });
    if (!existing) { missing.push(u.email); continue; }
    matched++;
    if (DRY) continue;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        operationalProjectId: u.operationalProjectId,
        roles: u.roles,
        isActive: u.isActive,
        mobileNumber: u.mobileNumber ?? existing.mobileNumber,
      },
    });
  }
  console.log('  المستخدمون: طوبقوا ' + matched + ' / ' + rows.length);
  if (missing.length) {
    console.log('  ⚠ غير موجودين في قاعدة الجامعة (أضفهم من دليل الجامعة أولاً):');
    for (const e of missing) console.log('      ' + e);
  }
}

// خريطة معرّفات النظام القديم → معرّفات قاعدة الجامعة (للمستخدمين فقط)
async function buildUserIdMap() {
  const rows = read('user') || [];
  const map = new Map();
  for (const u of rows) {
    const found = await prisma.user.findFirst({
      where: { email: { equals: u.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (found) map.set(u.id, found.id);
  }
  return map;
}

// الحقول التي تشير إلى مستخدم وتحتاج تحويل المعرّف
const USER_REFS = [
  'userId', 'authorId', 'createdById', 'primaryEmployeeId', 'executedById',
  'decidedById', 'overriddenById', 'extensionGrantedById', 'senderId',
  'recipientId', 'supervisorId', 'assignedById',
];

function remapUserIds(row, map) {
  const out = { ...row };
  for (const f of USER_REFS) {
    if (out[f] && map.has(out[f])) out[f] = map.get(out[f]);
  }
  return out;
}

(async () => {
  if (!fs.existsSync(IN)) {
    console.error('مجلد البيانات غير موجود: ' + IN);
    console.error('شغّل أولاً: node scripts/export-legacy.js');
    process.exit(1);
  }

  console.log(DRY ? '— معاينة فقط، لن يُكتب شيء —\n' : '— تنفيذ فعلي —\n');

  await importUsers();
  const userMap = await buildUserIdMap();
  console.log('');

  for (const [model, label] of ORDER) {
    const rows = read(model);
    if (!rows) { console.log('  تخطٍّ (لا ملف): ' + label); continue; }
    if (!prisma[model]?.upsert) { console.log('  تخطٍّ (جدول غير معروف): ' + label); continue; }

    let ok = 0, failed = 0;
    for (const raw of rows) {
      const data = remapUserIds(revive(raw), userMap);
      if (DRY) { ok++; continue; }
      try {
        await prisma[model].upsert({ where: { id: data.id }, update: data, create: data });
        ok++;
      } catch (e) {
        failed++;
        if (failed <= 3) console.log('      خطأ في سجل: ' + e.message.split('\n')[0].slice(0, 120));
      }
    }
    console.log(String(ok).padStart(7) + '  ' + label + (failed ? '   (فشل ' + failed + ')' : ''));
  }

  console.log('\n' + (DRY ? 'انتهت المعاينة.' : 'انتهى الاستيراد.'));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('فشل الاستيراد: ' + e.message.split('\n')[0]);
  await prisma.$disconnect();
  process.exit(1);
});
