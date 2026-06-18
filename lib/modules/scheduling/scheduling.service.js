// =============================================================
// وحدة الجدولة — محرك تشغيل المهام المجدولة (Service)
// -------------------------------------------------------------
// يُستدعى من مسار الكرون. يشغّل كل المهام المستحقة بالتوازي.
// عدد المهام غير محدود — المحرك يعالجها دفعة واحدة في كل جولة.
// كل وصول لقاعدة البيانات يمرّ عبر المستودع (repo).
// =============================================================

const repo = require('./scheduling.repo');
// notifications تبقى خدمة مشتركة — تُستورد كما هي
const { createNotification } = require('../../services/notifications');
const coursesService = require('../courses/courses.service');

// ======================================================================
// منفّذو أنواع المهام
// ======================================================================

/**
 * فحص الدورات المتأخرة: يرسل إشعاراً للمسؤول الرئيسي عن كل دورة
 * انتهت ولم تُقفل بعد، بعد يومين ثم أربعة أيام ثم أسبوع.
 */
async function runCourseDelayCheck(job) {
  const now = new Date();

  // تقديم الدورات تلقائياً عبر الحالات الوسيطة بناءً على تواريخها
  const lifecycle = await coursesService.advanceDueCourseLifecycles();

  const courses = await repo.findOverdueCourses(now);

  const notifications = [];

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
    notifications.push(
      createNotification(course.primaryEmployeeId, 'COURSE_DELAY', title, message, metadata),
    );

    // إشعار مشرفي المشروع
    for (const supervisor of course.operationalProject.supervisors) {
      notifications.push(
        createNotification(supervisor.userId, 'COURSE_DELAY', title, message, metadata),
      );
    }
  }

  await Promise.all(notifications);
  const notificationsSent = notifications.length;

  return { coursesChecked: courses.length, notificationsSent, lifecycle };
}

/**
 * فحص العناصر الراكدة: يرسل إشعاراً للعناصر التي لم تُحدَّث لأكثر من ٣ أيام.
 */
async function runElementStaleCheck(job) {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const staleElements = await repo.findStaleElements(threeDaysAgo);

  const notifications = staleElements.map((item) =>
    createNotification(
      item.course.primaryEmployeeId,
      'ELEMENT_STALE',
      'عنصر راكد',
      `العنصر "${item.element.name}" في الدورة "${item.course.name}" راكد منذ أكثر من ٣ أيام.`,
      { courseId: item.courseId, elementId: item.id },
    ),
  );

  await Promise.all(notifications);
  const notificationsSent = notifications.length;

  return { staleElementsChecked: staleElements.length, notificationsSent };
}

/**
 * تذكير العناصر المُعادة:
 *   - 24 ساعة بعد الإعادة بدون تقديم → تذكير للموظف
 *   - 48 ساعة بعد الإعادة بدون تقديم → تنبيه لمشرف المشروع
 */
async function runReturnedElementReminder(job) {
  const now = new Date();
  const ms24 = 24 * 60 * 60 * 1000;
  const ms48 = 48 * 60 * 60 * 1000;

  const returnedElements = await repo.findReturnedElements();

  const notifications = [];

  for (const item of returnedElements) {
    if (!item.decisionAt) continue;
    const returnedAt = new Date(item.decisionAt);
    const elapsed = now.getTime() - returnedAt.getTime();

    const employeeName = `${item.course.primaryEmployee.firstName} ${item.course.primaryEmployee.lastName}`;
    const elementName = item.element.name;
    const courseName = item.course.name;
    const meta = { courseId: item.courseId, trackingId: item.id, elementName };

    // تذكير الموظف: مضت 24 ساعة ولم يتجاوز 48
    if (elapsed >= ms24 && elapsed < ms48) {
      notifications.push(
        createNotification(
          item.course.primaryEmployeeId,
          'ELEMENT_RETURNED_REMINDER',
          `تذكير: عنصر بحاجة للتصحيح`,
          `مضى أكثر من 24 ساعة على إعادة "${elementName}" في الدورة "${courseName}". يُرجى التصحيح وإعادة التقديم.`,
          meta,
        ),
      );
    }

    // تنبيه المشرف: مضت 48 ساعة
    if (elapsed >= ms48) {
      for (const supervisor of item.course.operationalProject?.supervisors || []) {
        notifications.push(
          createNotification(
            supervisor.userId,
            'ELEMENT_RETURNED_OVERDUE',
            `تأخر في إعادة التقديم`,
            `الموظف ${employeeName} لم يُعد تقديم "${elementName}" في الدورة "${courseName}" منذ أكثر من 48 ساعة.`,
            { ...meta, employeeId: item.course.primaryEmployeeId },
          ),
        );
      }
    }
  }

  await Promise.all(notifications);
  const notificationsSent = notifications.length;

  return { checkedElements: returnedElements.length, notificationsSent };
}

/**
 * لقطة مؤشرات الأداء الدورية (اختيارية)
 */
async function runKpiAutoSnapshot(job) {
  const payload = job.payload || {};
  const periodType = payload.periodType || 'MONTHLY';

  // نستدعي خدمة KPI من وحدتها المعيارية
  const kpisService = require('../kpi/kpi.service');
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
// تذكير التأمين الطبي للدورات الخارجية
// ======================================================================

/**
 * التأمين الطبي — يُرسل تذكيراً قبل 24 ساعة من بداية الدورة
 * لكل دورة خارجية لم يُقدَّم فيها عنصر التأمين بعد.
 * المستلمون: الموظف المسؤول + مشرفو المشروع + جميع المديرين
 */
async function runMedicalInsuranceReminder() {
  const now = new Date();
  // نافذة البحث: الدورات التي تبدأ خلال 12–36 ساعة من الآن
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  // جلب عنصر التأمين من قاعدة البيانات
  const insuranceEl = await repo.findInsuranceElement();
  if (!insuranceEl) return { skipped: true, reason: 'عنصر medical_insurance غير موجود في قاعدة البيانات' };

  // الدورات الخارجية التي تبدأ خلال 12–36 ساعة ولم يُقفل فيها التأمين بعد
  const pendingInsurance = await repo.findPendingInsurance(insuranceEl.id, windowStart, windowEnd);

  // جلب جميع المديرين لإرسال الإشعار لهم
  const managers = await repo.findActiveManagers();

  const notifications = [];

  for (const tracking of pendingInsurance) {
    const course = tracking.course;
    const startStr = new Date(course.startDate).toLocaleDateString('ar-SA', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const title   = `⚠️ تذكير: التأمين الطبي — ${course.name}`;
    const message = `الدورة الخارجية "${course.name}" تبدأ في ${startStr}. لم يُستخرج التأمين الطبي للمتدربين بعد. الموعد الأقصى: بعد بداية الدورة بـ 3 أيام.`;
    const meta    = { courseId: course.id, courseName: course.name, trackingId: tracking.id, elementKey: 'medical_insurance' };

    // إشعار الموظف المسؤول
    notifications.push(createNotification(course.primaryEmployeeId, 'MEDICAL_INSURANCE_REMINDER', title, message, meta));

    // إشعار مشرفي المشروع
    for (const sup of course.operationalProject?.supervisors || []) {
      notifications.push(createNotification(sup.userId, 'MEDICAL_INSURANCE_REMINDER', title, message, meta));
    }

    // إشعار المديرين
    for (const mgr of managers) {
      notifications.push(createNotification(mgr.id, 'MEDICAL_INSURANCE_REMINDER', title, message, meta));
    }
  }

  await Promise.all(notifications);
  const notificationsSent = notifications.length;

  return { coursesChecked: pendingInsurance.length, notificationsSent };
}

// ======================================================================
// سجل الموزّع (Dispatcher)
// ======================================================================

// موزّع المهام المخصصة — يقرأ payload.handler لتحديد المنفّذ
const CUSTOM_HANDLERS = {
  RETURNED_ELEMENT_REMINDER:   runReturnedElementReminder,
  MEDICAL_INSURANCE_REMINDER:  runMedicalInsuranceReminder,
};

async function runCustomJob(job) {
  const handler = job.payload?.handler;
  const fn = CUSTOM_HANDLERS[handler];
  if (!fn) return { skipped: true, reason: `no handler: ${handler}` };
  return fn(job);
}

const JOB_RUNNERS = {
  COURSE_DELAY_CHECK: runCourseDelayCheck,
  ELEMENT_STALE_CHECK: runElementStaleCheck,
  KPI_AUTO_SNAPSHOT: runKpiAutoSnapshot,
  CUSTOM: runCustomJob,
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

  const dueJobs = await repo.findDueJobs(now);

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
      // عند النجاح: الجولة التالية بعد intervalHours.
      // عند الفشل: نبقي المهمة ACTIVE ونؤجّلها بفترة تراجع (backoff) قصيرة
      // بحد أقصى 6 ساعات حتى تُعاد المحاولة لاحقاً بدل استبعادها للأبد (FAILED).
      const backoffHours = error ? Math.min(job.intervalHours, 6) : job.intervalHours;
      const nextRunAt = new Date(now.getTime() + backoffHours * 60 * 60 * 1000);

      await repo.updateJobAfterRun(job.id, {
        lastRunAt: now,
        nextRunAt,
        lastResult: result ? { ...result, durationMs } : null,
        lastError: error,
        runCount: { increment: 1 },
        // تبقى المهمة قابلة لإعادة المحاولة حتى عند الفشل
        status: newStatus,
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
  return repo.findAllJobs();
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

  return repo.createJob({
    name,
    type,
    intervalHours: Number(intervalHours),
    payload: payload || null,
    nextRunAt: new Date(), // أول تشغيل فوراً
    status: 'ACTIVE',
  });
}

async function updateJob(id, data) {
  const allowed = ['name', 'intervalHours', 'payload', 'status'];
  const updateData = {};
  for (const key of allowed) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  // تحويل وتحقق الحقول الرقمية (نفس منطق createJob) لمنع nextRunAt = Invalid Date لاحقاً
  if (updateData.intervalHours !== undefined) {
    const n = Number(updateData.intervalHours);
    if (!Number.isFinite(n) || n < 1) {
      const err = new Error('intervalHours غير صالح');
      err.statusCode = 400;
      throw err;
    }
    updateData.intervalHours = Math.trunc(n);
  }

  return repo.updateJob(id, updateData);
}

async function deleteJob(id) {
  await repo.deleteJob(id);
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
