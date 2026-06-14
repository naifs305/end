import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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

  const passwordHash = await bcrypt.hash('Zx.321321', 10);

  await prisma.user.upsert({
    where: { email: 'Nalshahrani@nauss.edu.sa' },
    update: {
      email: 'Nalshahrani@nauss.edu.sa',
      passwordHash,
      firstName: 'نايف',
      lastName: 'الشهراني',
      mobileNumber: '0568122221',
      roles: [Role.MANAGER, Role.EMPLOYEE],
      operationalProjectId: 'proj_1',
      isActive: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
    create: {
      email: 'Nalshahrani@nauss.edu.sa',
      passwordHash,
      firstName: 'نايف',
      lastName: 'الشهراني',
      mobileNumber: '0568122221',
      roles: [Role.MANAGER, Role.EMPLOYEE],
      operationalProjectId: 'proj_1',
      isActive: true,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
  });

  // المواعيد: deadlineRefPoint='START' = من بداية الدورة، 'END' = من نهايتها
  // الأرقام السالبة = قبل نقطة المرجع (أي قبل بداية الدورة)
  // isDeadlineWorkingDays = true عند العناصر التي تُحسب بأيام عمل
  const elements = [
    {
      key: 'trainee_registration', name: 'تسجيل المتدربين في المنصة', isFormBased: false,
      deadlineRefPoint: 'START', deadlineIdealHours: -72, deadlineMaxHours: -24, isDeadlineWorkingDays: false,
    },
    {
      key: 'registration_message', name: 'إرسال رسالة للمتدربين', isFormBased: false,
      deadlineRefPoint: 'START', deadlineIdealHours: -48, deadlineMaxHours: 0, isDeadlineWorkingDays: false,
    },
    {
      key: 'advance_req', name: 'طلب السلفة المؤقتة', isFormBased: true,
      deadlineRefPoint: 'START', deadlineIdealHours: -120, deadlineMaxHours: -72, isDeadlineWorkingDays: true,
    },
    {
      key: 'pre_test', name: 'تقديم الاختبار القبلي', isFormBased: false,
      deadlineRefPoint: 'START', deadlineIdealHours: 0, deadlineMaxHours: 24, isDeadlineWorkingDays: false,
    },
    {
      key: 'opening_report', name: 'تقرير افتتاح الدورة', isFormBased: true,
      deadlineRefPoint: 'START', deadlineIdealHours: 0, deadlineMaxHours: 24, isDeadlineWorkingDays: false,
    },
    {
      key: 'reaction_evaluation', name: 'تقديم تقييم الدورة', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 0, deadlineMaxHours: 24, isDeadlineWorkingDays: false,
    },
    {
      key: 'post_test', name: 'تقديم الاختبار البعدي', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 0, deadlineMaxHours: 24, isDeadlineWorkingDays: false,
    },
    {
      key: 'certificates', name: 'إصدار الشهادات', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 72, deadlineMaxHours: 120, isDeadlineWorkingDays: true,
    },
    {
      key: 'closing_report', name: 'تقرير اختتام الدورة', isFormBased: true,
      deadlineRefPoint: 'END', deadlineIdealHours: 24, deadlineMaxHours: 72, isDeadlineWorkingDays: false,
    },
    {
      key: 'supervisor_compensation', name: 'رفع مستحقات المشرف', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 72, deadlineMaxHours: 120, isDeadlineWorkingDays: true,
    },
    {
      key: 'trainer_compensation', name: 'رفع مستحقات المدرب', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 72, deadlineMaxHours: 120, isDeadlineWorkingDays: true,
    },
    {
      key: 'revenues', name: 'رفع الإيرادات المالية', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 72, deadlineMaxHours: 120, isDeadlineWorkingDays: false,
    },
    {
      key: 'materials', name: 'إعادة المواد التدريبية المعارة', isFormBased: false,
      deadlineRefPoint: 'END', deadlineIdealHours: 24, deadlineMaxHours: 72, isDeadlineWorkingDays: false,
    },
    {
      key: 'settlement', name: 'تسوية السلفة المؤقتة', isFormBased: true,
      deadlineRefPoint: 'END', deadlineIdealHours: 120, deadlineMaxHours: 240, isDeadlineWorkingDays: true,
    },
    // ── التأمين الطبي: دورات خارجية فقط ─────────────────────────────────
    // المثالي: قبل بداية الدورة بـ 72 ساعة (3 أيام) → idealHours = -72
    // الأقصى:  بعد بداية الدورة بـ 72 ساعة (3 أيام) → maxHours  = +72
    {
      key: 'medical_insurance', name: 'استخراج التأمين الطبي للمتدربين', isFormBased: true,
      deadlineRefPoint: 'START', deadlineIdealHours: -72, deadlineMaxHours: 72, isDeadlineWorkingDays: false,
    },
  ];

  for (const el of elements) {
    await prisma.closureElement.upsert({
      where: { key: el.key },
      update: {
        name: el.name,
        isFormBased: el.isFormBased,
        deadlineRefPoint: el.deadlineRefPoint,
        deadlineIdealHours: el.deadlineIdealHours,
        deadlineMaxHours: el.deadlineMaxHours,
        isDeadlineWorkingDays: el.isDeadlineWorkingDays,
      },
      create: el,
    });
  }

  // --- هجرة ناعمة: إذا وُجد العنصر القديم "report"، نحوّل سجلاته للعنصر الجديد "closing_report" ---
  const legacyReport = await prisma.closureElement.findUnique({ where: { key: 'report' } });
  if (legacyReport) {
    const closingReport = await prisma.closureElement.findUnique({ where: { key: 'closing_report' } });
    if (closingReport) {
      await prisma.courseClosureTracking.updateMany({
        where: { elementId: legacyReport.id },
        data: { elementId: closingReport.id },
      });
      await prisma.closureElement.delete({ where: { id: legacyReport.id } });
    }
  }

  // --- المهام المجدولة الافتراضية ---
  const defaultJobs = [
    {
      name: 'فحص الدورات المتأخرة يومياً',
      type: 'COURSE_DELAY_CHECK' as const,
      intervalHours: 24,
      payload: null,
    },
    {
      name: 'فحص العناصر الراكدة كل 6 ساعات',
      type: 'ELEMENT_STALE_CHECK' as const,
      intervalHours: 6,
      payload: null,
    },
    {
      name: 'تذكير العناصر المُعادة كل 4 ساعات',
      type: 'CUSTOM' as const,
      intervalHours: 4,
      payload: { handler: 'RETURNED_ELEMENT_REMINDER' },
    },
    {
      name: 'تذكير التأمين الطبي للدورات الخارجية كل 6 ساعات',
      type: 'CUSTOM' as const,
      intervalHours: 6,
      payload: { handler: 'MEDICAL_INSURANCE_REMINDER' },
    },
  ];

  for (const job of defaultJobs) {
    const existing = await prisma.scheduledJob.findFirst({
      where: { type: job.type },
    });

    if (!existing) {
      await prisma.scheduledJob.create({
        data: {
          name: job.name,
          type: job.type,
          intervalHours: job.intervalHours,
          payload: job.payload ?? null,
          nextRunAt: new Date(),
          status: 'ACTIVE',
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });