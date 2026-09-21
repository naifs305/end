// =============================================================
// تصدير بيانات النظام القديم (سحب)
// -------------------------------------------------------------
// يقرأ الجداول بـ SQL مباشر لا عبر نماذج Prisma، لأن قاعدة النظام
// القديم أقدم من المخطط الحالي وتنقصها بعض الأعمدة — القراءة المباشرة
// تأخذ الأعمدة الموجودة فعلاً مهما كان إصدار القاعدة.
//
// الحقول الحساسة (كلمات المرور والرموز) تُستبعد نهائياً.
//
// التشغيل:  node scripts/export-legacy.js
// المخرج:   الملفات المساعدة/نقل البيانات/  داخل المشروع
// =============================================================

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
if (!process.env.DATABASE_URL) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OUT = path.join(__dirname, '..', 'الملفات المساعدة', 'نقل البيانات');

const SECRETS = new Set([
  'password', 'passwordHash', 'hashedPassword',
  'resetToken', 'resetTokenExpiry', 'refreshToken', 'token', 'tokenVersion',
]);

// الترتيب = ترتيب الاستيراد الصحيح (المستقل قبل المرتبط)
const TABLES = [
  ['OperationalProject',       'المشاريع التشغيلية'],
  ['User',                     'المستخدمون'],
  ['ProjectSupervisor',        'مشرفو المشاريع'],
  ['ClosureElement',           'عناصر الإقفال (التعريف)'],
  ['Course',                   'الدورات'],
  ['CourseSupport',            'الفريق المساند'],
  ['CourseClosureTracking',    'متابعة إقفال الدورات'],
  ['CourseOptionalReport',     'التقارير الاختيارية'],
  ['FieldReport',              'التقارير الميدانية'],
  ['CourseAssignmentRegister', 'سجل إسناد الدورات'],
  ['EmployeeKpiSetting',       'إعدادات المؤشرات'],
  ['EmployeeKpiSnapshot',      'لقطات المؤشرات'],
  ['EmployeeKpiNote',          'ملاحظات المؤشرات'],
  ['EmployeeBadge',            'أوسمة الموظفين'],
  ['ImprovementIdea',          'أفكار التحسين'],
  ['IdeaSupport',              'دعم الأفكار'],
  ['TeamChallenge',            'تحديات الفريق'],
  ['MonthlyPledge',            'التعهدات الشهرية'],
  ['Message',                  'الرسائل'],
  ['MessageRecipient',         'مستلمو الرسائل'],
  ['Notification',             'الإشعارات'],
  ['AuditLog',                 'سجل التدقيق'],
  ['ScheduledJob',             'المهام المجدولة'],
  ['OptionItem',               'قوائم الخيارات'],
  ['AppSetting',               'إعدادات النظام'],
  ['Translation',              'الترجمات'],
];

// BigInt لا يُسلسَل في JSON — نحوّله نصاً
const norm = (v) => {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
};

const scrub = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRETS.has(k)) continue;
    out[k] = norm(v);
  }
  return out;
};

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = [...rows.reduce((s, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set())];
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

(async () => {
  fs.mkdirSync(path.join(OUT, 'JSON'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'CSV'), { recursive: true });

  const present = new Set(
    (await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    )).map((r) => r.table_name)
  );

  const summary = [];

  for (const [table, label] of TABLES) {
    if (!present.has(table)) { console.log('  تخطٍّ (غير موجود): ' + label); continue; }
    const raw = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
    const rows = raw.map(scrub);

    fs.writeFileSync(path.join(OUT, 'JSON', table + '.json'), JSON.stringify(rows, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUT, 'CSV', table + '.csv'), '﻿' + toCsv(rows), 'utf8');

    summary.push({ table, label, count: rows.length });
    console.log(String(rows.length).padStart(7) + '  ' + label);
  }

  // توزيع المنسقين — ملف مستقل يسهل مراجعته
  const dist = await prisma.$queryRawUnsafe(`
    SELECT u."email", u."firstName", u."lastName", u."roles", u."isActive",
           u."operationalProjectId", p."name" AS "projectName"
    FROM "User" u LEFT JOIN "OperationalProject" p ON p."id" = u."operationalProjectId"
    ORDER BY p."name", u."firstName"
  `);
  const distClean = dist.map(scrub);
  fs.writeFileSync(path.join(OUT, 'توزيع-المنسقين.json'), JSON.stringify(distClean, null, 2), 'utf8');
  fs.writeFileSync(path.join(OUT, 'توزيع-المنسقين.csv'), '﻿' + toCsv(distClean), 'utf8');

  const total = summary.reduce((n, s) => n + s.count, 0);
  fs.writeFileSync(path.join(OUT, 'ملخص.json'), JSON.stringify({
    exportedAt: new Date().toISOString(), total, tables: summary,
  }, null, 2), 'utf8');

  console.log('\n  الإجمالي: ' + total + ' سجل');
  console.log('  المجلد: ' + OUT);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('فشل التصدير:\n' + (e.stack || e.message));
  await prisma.$disconnect();
  process.exit(1);
});
