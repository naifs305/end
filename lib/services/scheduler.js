// =============================================================
// محرك تشغيل المهام المجدولة
// -------------------------------------------------------------
// يُستدعى من مسار الكرون. يشغّل كل المهام المستحقة بالتوازي.
// عدد المهام غير محدود — المحرك يعالجها دفعة واحدة في كل جولة.
// =============================================================

const prisma = require('../db/prisma');
const { createNotification } = require('./notifications');

// ======================================================================
// منفّذو أنواع المهام
// ======================================================================

/**
 * فحص الدورات المتأخرة: يرسل إشعاراً للمسؤول الرئيسي عن كل دورة
 * انتهت ولم تُقفل بعد، بعد يومين ثم أربعة أيام ثم أسبوع.
 */
async function runCourseDelayCheck(job) {
  const now = new Date();

  const courses = await prisma.course.findMany({
    where: {
      endDate: { lt: now },
      status: { notIn: ['CLOSED', 'ARCHIVED'] },
    },
    include: {
      closureElements: { include: { element: true } },
      primaryEmployee: true,
      operationalProject: {
        include: {
          supervisors: { include: { user: true } },
        },
      },
    },
  });

  let notificationsSent = 0;

  for (const course of courses) {
    const daysSinceEnd = Math.floor(
      (now.getTime() - new Date(course.endDate).getTime()) / (1000 * 60 * 60 * 24),
    );

    // تنبيهات في محطات محددة (يومان، أربعة، سبعة، أربعة عشر)
    const alertDays = [2, 4, 7, 14];
    if (!alertDays.includes(daysSinceEnd)) continue;

    const pendingElements = course.closureElements.filter(
      (el) => el.status !== 'APPROVED' && el.status !== 'NOT_APPLICABLE',
    );

    if (pendingElements.length === 0) continue;

    const title = `تأخر إقفال الدورة — ${daysSinceEnd} ${daysSinceEnd === 1 ? 'يوم' : 'أيام'}`;
    const message = `الدورة "${course.name}" انتهت منذ ${daysSinceEnd} ${daysSinceEnd === 1 ? 'يوماً' : 'أياماً'} وما زال لديها ${pendingElements.length} عنصر إقفال معلّق.`;
    const metadata = { courseId: course.id, courseName: course.name, daysOverdue: daysSinceEnd };

    // إشعار المسؤول الرئيسي
    await createNotification(
      course.primaryEmployeeId, 'COURSE_DELAY', title, message, metadata,
    );
    notificationsSent++;

    // إشعار مشرفي المشروع
    for (const supervisor of course.operationalProject.supervisors) {
      await createNotification(supervisor.userId, 'COURSE_DELAY', title, message, metadata);
      notificationsSent++;
    }
  }

  return { coursesChecked: courses.length, notificationsSent };
}

/**
 * فحص العناصر الراكدة: يرسل إشعاراً للعناصر التي لم تُحدَّث لأكثر من ٣ أيام.
 */
async function runElementStaleCheck(job) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const staleElements = await prisma.courseClosureTracking.findMany({
    where: {
      status: { in: ['NOT_STARTED', 'RETURNED'] },
      course: { status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      OR: [
        { decisionAt: { lt: threeDaysAgo } },
        { AND: [{ decisionAt: null }, { course: { createdAt: { lt: threeDaysAgo } } }] },
      ],
    },
    include: {
      element: true,
      course: { include: { primaryEmployee: true } },
    },
    take: 100, // حد أعلى للأمان
  });

  let notificationsSent = 0;

  for (const item of staleElements) {
    await createNotification(
      item.course.primaryEmployeeId,
      'ELEMENT_STALE',
      'عنصر راكد',
      `العنصر "${item.element.name}" في الدورة "${item.course.name}" راكد منذ أكثر من ٣ أيام.`,
      { courseId: item.courseId, elementId: item.id },
    );
    notificationsSent++;
  }

  return { staleElementsChecked: staleElements.length, notificationsSent };
}

/**
 * لقطة مؤشرات الأداء الدورية (اختيارية)
 */
async function runKpiAutoSnapshot(job) {
  const payload = job.payload || {};
  const periodType = payload.periodType || 'MONTHLY';

  // نستدعي خدمة KPI من هنا
  const kpisService = require('./kpis');
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const result = await kpisService.calculateAndStore(
    periodType,
    year,
    periodType === 'MONTHLY' ? month : (periodType === 'QUARTERLY' ? Math.ceil(month / 3) : undefined),
    'system',
  );

  return {
    periodLabel: result.periodLabel,
    employeesCount: result.employeesCount,
  };
}

// ======================================================================
// سجل الموزّع (Dispatcher)
// ======================================================================

const JOB_RUNNERS = {
  COURSE_DELAY_CHECK: runCourseDelayCheck,
  ELEMENT_STALE_CHECK: runElementStaleCheck,
  KPI_AUTO_SNAPSHOT: runKpiAutoSnapshot,
  // CUSTOM: يُنفّذ منطقاً مخصصاً عبر payload
};

// ======================================================================
// تشغيل دفعة واحدة من المهام المستحقة
// ======================================================================

/**
 * يشغّل جميع المهام المستحقة (nextRunAt <= now) بالتوازي.
 * يُستدعى من مسار /api/cron/run.
 */
async function runDueJobs() {
  const now = new Date();

  const dueJobs = await prisma.scheduledJob.findMany({
    where: {
      status: 'ACTIVE',
      nextRunAt: { lte: now },
    },
  });

  const results = [];

  // تشغيل بالتوازي
  await Promise.all(
    dueJobs.map(async (job) => {
      const startTime = Date.now();
      let result = null;
      let error = null;
      let newStatus = 'ACTIVE';

      try {
        const runner = JOB_RUNNERS[job.type];
        if (!runner) {
          error = `نوع مهمة غير معروف: ${job.type}`;
        } else {
          result = await runner(job);
        }
      } catch (err) {
        error = err.message || String(err);
      }

      const durationMs = Date.now() - startTime;
      const nextRunAt = new Date(now.getTime() + job.intervalHours * 60 * 60 * 1000);

      await prisma.scheduledJob.update({
        where: { id: job.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          lastResult: result ? { ...result, durationMs } : null,
          lastError: error,
          runCount: { increment: 1 },
          status: error ? 'FAILED' : newStatus,
        },
      });

      results.push({
        jobId: job.id,
        name: job.name,
        type: job.type,
        success: !error,
        result,
        error,
        durationMs,
      });
    }),
  );

  return {
    runAt: now,
    jobsRun: results.length,
    results,
  };
}

// ======================================================================
// إدارة المهام
// ======================================================================

async function listJobs() {
  return prisma.scheduledJob.findMany({
    orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
  });
}

async function createJob(data) {
  const { name, type, intervalHours, payload } = data;

  if (!name || !type || !intervalHours) {
    const err = new Error('اسم المهمة ونوعها وفترتها مطلوبة');
    err.statusCode = 400;
    throw err;
  }

  if (!JOB_RUNNERS[type] && type !== 'CUSTOM') {
    const err = new Error(`نوع مهمة غير مدعوم: ${type}`);
    err.statusCode = 400;
    throw err;
  }

  return prisma.scheduledJob.create({
    data: {
      name,
      type,
      intervalHours: Number(intervalHours),
      payload: payload || null,
      nextRunAt: new Date(), // أول تشغيل فوراً
      status: 'ACTIVE',
    },
  });
}

async function updateJob(id, data) {
  const allowed = ['name', 'intervalHours', 'payload', 'status'];
  const updateData = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }
  return prisma.scheduledJob.update({ where: { id }, data: updateData });
}

async function deleteJob(id) {
  await prisma.scheduledJob.delete({ where: { id } });
  return { success: true };
}

module.exports = {
  runDueJobs,
  listJobs,
  createJob,
  updateJob,
  deleteJob,

  // منفّذون مُصدَّرون للاختبار
  runners: JOB_RUNNERS,
};
