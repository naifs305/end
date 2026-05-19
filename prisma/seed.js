// seed.js — بيانات أولية (JavaScript순 بدون TypeScript)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // --- المشاريع الافتراضية ---
  const projects = [
    { id: 'proj_1', name: 'مشروع القيادة الأمنية' },
    { id: 'proj_2', name: 'مشروع التهديدات الحديثة' },
    { id: 'proj_3', name: 'مشروع الوقاية الأمنية' },
  ];

  for (const p of projects) {
    await prisma.operationalProject.upsert({
      where: { id: p.id },
      update: { name: p.name },
      create: p,
    });
  }

  // --- المستخدم الافتراضي ---
  const passwordHash = await bcrypt.hash('Zx.321321', 10);
  await prisma.user.upsert({
    where: { email: 'Nalshahrani@nauss.edu.sa' },
    update: {
      passwordHash,
      firstName: 'نايف', lastName: 'الشهراني',
      mobileNumber: '0568122221',
      roles: ['MANAGER', 'EMPLOYEE'],
      operationalProjectId: 'proj_1',
      isActive: true, termsAccepted: true, termsAcceptedAt: new Date(),
    },
    create: {
      email: 'Nalshahrani@nauss.edu.sa',
      passwordHash,
      firstName: 'نايف', lastName: 'الشهراني',
      mobileNumber: '0568122221',
      roles: ['MANAGER', 'EMPLOYEE'],
      operationalProjectId: 'proj_1',
      isActive: true, termsAccepted: true, termsAcceptedAt: new Date(),
    },
  });

  // --- عناصر الإقفال مع مواعيدها ---
  const elements = [
    { key: 'trainee_registration', name: 'تسجيل المتدربين في المنصة',  isFormBased: false, deadlineRefPoint: 'START', deadlineIdealHours: -72,  deadlineMaxHours: -24, isDeadlineWorkingDays: false },
    { key: 'registration_message', name: 'إرسال رسالة للمتدربين',       isFormBased: false, deadlineRefPoint: 'START', deadlineIdealHours: -48,  deadlineMaxHours:   0, isDeadlineWorkingDays: false },
    { key: 'advance_req',          name: 'طلب السلفة المؤقتة',          isFormBased: true,  deadlineRefPoint: 'START', deadlineIdealHours: -120, deadlineMaxHours: -72, isDeadlineWorkingDays: true  },
    { key: 'pre_test',             name: 'تقديم الاختبار القبلي',        isFormBased: false, deadlineRefPoint: 'START', deadlineIdealHours:   0,  deadlineMaxHours:  24, isDeadlineWorkingDays: false },
    { key: 'opening_report',       name: 'تقرير افتتاح الدورة',         isFormBased: true,  deadlineRefPoint: 'START', deadlineIdealHours:   0,  deadlineMaxHours:  24, isDeadlineWorkingDays: false },
    { key: 'reaction_evaluation',  name: 'تقديم تقييم الدورة',          isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:   0,  deadlineMaxHours:  24, isDeadlineWorkingDays: false },
    { key: 'post_test',            name: 'تقديم الاختبار البعدي',        isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:   0,  deadlineMaxHours:  24, isDeadlineWorkingDays: false },
    { key: 'certificates',         name: 'إصدار الشهادات',              isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:  72,  deadlineMaxHours: 120, isDeadlineWorkingDays: true  },
    { key: 'closing_report',       name: 'تقرير اختتام الدورة',         isFormBased: true,  deadlineRefPoint: 'END',   deadlineIdealHours:  24,  deadlineMaxHours:  72, isDeadlineWorkingDays: false },
    { key: 'supervisor_compensation', name: 'رفع مستحقات المشرف',       isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:  72,  deadlineMaxHours: 120, isDeadlineWorkingDays: true  },
    { key: 'trainer_compensation', name: 'رفع مستحقات المدرب',          isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:  72,  deadlineMaxHours: 120, isDeadlineWorkingDays: true  },
    { key: 'revenues',             name: 'رفع الإيرادات المالية',        isFormBased: false, deadlineRefPoint: 'END',   deadlineIdealHours:  72,  deadlineMaxHours: 120, isDeadlineWorkingDays: false },
    { key: 'materials',            name: 'إعادة المواد التدريبية المعارة', isFormBased: false, deadlineRefPoint: 'END', deadlineIdealHours:  24,  deadlineMaxHours:  72, isDeadlineWorkingDays: false },
    { key: 'settlement',           name: 'تسوية السلفة المؤقتة',        isFormBased: true,  deadlineRefPoint: 'END',   deadlineIdealHours: 120,  deadlineMaxHours: 240, isDeadlineWorkingDays: true  },
  ];

  for (const el of elements) {
    await prisma.closureElement.upsert({
      where: { key: el.key },
      update: { name: el.name, isFormBased: el.isFormBased, deadlineRefPoint: el.deadlineRefPoint, deadlineIdealHours: el.deadlineIdealHours, deadlineMaxHours: el.deadlineMaxHours, isDeadlineWorkingDays: el.isDeadlineWorkingDays },
      create: el,
    });
  }

  // --- هجرة ناعمة: العنصر القديم "report" → "closing_report" ---
  const legacyReport = await prisma.closureElement.findUnique({ where: { key: 'report' } });
  if (legacyReport) {
    const closingReport = await prisma.closureElement.findUnique({ where: { key: 'closing_report' } });
    if (closingReport) {
      await prisma.courseClosureTracking.updateMany({ where: { elementId: legacyReport.id }, data: { elementId: closingReport.id } });
      await prisma.closureElement.delete({ where: { id: legacyReport.id } });
    }
  }

  // --- المهام المجدولة الافتراضية ---
  const defaultJobs = [
    { name: 'فحص الدورات المتأخرة يومياً',         type: 'COURSE_DELAY_CHECK', intervalHours: 24, payload: null },
    { name: 'فحص العناصر الراكدة كل 6 ساعات',      type: 'ELEMENT_STALE_CHECK', intervalHours: 6,  payload: null },
    { name: 'تذكير العناصر المُعادة كل 4 ساعات',   type: 'CUSTOM',             intervalHours: 4,  payload: { handler: 'RETURNED_ELEMENT_REMINDER' } },
  ];

  for (const job of defaultJobs) {
    const existing = await prisma.scheduledJob.findFirst({ where: { type: job.type } });
    if (!existing) {
      await prisma.scheduledJob.create({
        data: { name: job.name, type: job.type, intervalHours: job.intervalHours, payload: job.payload, nextRunAt: new Date(), status: 'ACTIVE' },
      });
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
