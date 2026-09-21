// =============================================================
// تصدير بيانات النظام القديم (سحب)
// -------------------------------------------------------------
// يقرأ قاعدة بيانات النظام القديم عبر Prisma ويكتب ملفات JSON
// جاهزة للاستيراد في قاعدة بيانات الجامعة الرسمية.
//
// الحقول الحساسة (كلمات المرور والرموز) تُستبعد نهائياً.
//
// التشغيل:  node scripts/export-legacy.js
// المخرج:   C:\nif\الملفات المساعدة\نقل البيانات\
// =============================================================

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
if (!process.env.DATABASE_URL) require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// خارج مجلد المشروع عمداً: بيانات شخصية والمستودع منشور
const OUT = path.join('C:', 'nif', 'الملفات المساعدة', 'نقل البيانات');

const SECRETS = new Set([
  'password', 'passwordHash', 'hashedPassword',
  'resetToken', 'resetTokenExpiry', 'refreshToken', 'token', 'tokenVersion',
]);

// الترتيب = ترتيب الاستيراد الصحيح (المستقل قبل المرتبط)
const TABLES = [
  ['operationalProject',       'المشاريع التشغيلية'],
  ['user',                     'المستخدمون'],
  ['projectSupervisor',        'مشرفو المشاريع'],
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
  ['scheduledJob',             'المهام المجدولة'],
];

const scrub = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SECRETS.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const summary = [];

  for (const [model, label] of TABLES) {
    if (!prisma[model]?.findMany) { console.log('  تخطٍّ: ' + model); continue; }
    const rows = (await prisma[model].findMany()).map(scrub);
    fs.writeFileSync(path.join(OUT, model + '.json'), JSON.stringify(rows, null, 2), 'utf8');
    summary.push({ model, label, count: rows.length });
    console.log(String(rows.length).padStart(7) + '  ' + label);
  }

  // توزيع المنسقين على المشاريع — ملف مستقل يسهل مراجعته
  const users = await prisma.user.findMany({ include: { operationalProject: true } });
  const dist = users.map((u) => ({
    email: u.email,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    projectId: u.operationalProjectId,
    projectName: u.operationalProject?.name || null,
    roles: u.roles,
    isActive: u.isActive,
  })).sort((a, b) => String(a.projectName).localeCompare(String(b.projectName), 'ar'));
  fs.writeFileSync(path.join(OUT, 'توزيع-المنسقين.json'), JSON.stringify(dist, null, 2), 'utf8');

  const total = summary.reduce((n, s) => n + s.count, 0);
  fs.writeFileSync(path.join(OUT, 'ملخص.json'), JSON.stringify({
    exportedAt: new Date().toISOString(), total, tables: summary,
  }, null, 2), 'utf8');

  console.log('\n  الإجمالي: ' + total + ' سجل');
  console.log('  المجلد: ' + OUT);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('فشل التصدير: ' + e.message.split('\n')[0]);
  await prisma.$disconnect();
  process.exit(1);
});
