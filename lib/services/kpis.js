// =============================================================
// منظومة مؤشرات الأداء المطورة — النسخة الموسعة
// -------------------------------------------------------------
// تحسينات رئيسية عن النسخة السابقة:
//   ١. أوزان ديناميكية من قاعدة البيانات (EmployeeKpiSetting)
//   ٢. حساب صحيح لمتوسط تأخر إقفال الدورات
//   ٣. تفاصيل أداء لكل نوع عنصر إقفال
//   ٤. مقارنة مع الفترة السابقة (Trend)
//   ٥. رؤى ذكية باللغة العربية مبنية على البيانات
//   ٦. فلتر صلاحيات كامل (مدير / مشرف / موظف)
// =============================================================

const prisma = require('../db/prisma');
const { logAudit } = require('./audit');
const { createNotification } = require('./notifications');
const { CROSS_PROJECT_MULTIPLIER, isOfficialPeriod } = require('../config');

// ======================================================================
// حساب درجة التوقيت لكل عنصر بناءً على مواعيده المحددة
// ======================================================================

/**
 * يحسب درجة التوقيت لعنصر واحد:
 * 100 = قُدِّم قبل أو في الموعد المثالي
 *  70 = قُدِّم بعد المثالي لكن قبل الأقصى (مع تمديد إن وجد)
 *  20 = قُدِّم بعد الموعد الأقصى
 *   0 = لم يُقدَّم بعد ولا يزال مطلوباً
 */
function calcElementTimeScore(tracking, course) {
  const el = tracking.element;
  if (!el?.deadlineRefPoint || el.deadlineIdealHours == null || el.deadlineMaxHours == null) {
    // لا يوجد موعد محدد → لا عقوبة على الوقت
    return tracking.executionAt ? 100 : null;
  }

  const refDate = el.deadlineRefPoint === 'START'
    ? new Date(course.startDate)
    : new Date(course.endDate);

  const MS = 1000 * 60 * 60;
  const idealDeadline = new Date(refDate.getTime() + el.deadlineIdealHours * MS);
  const extraHours = tracking.extensionHours || 0;
  const maxDeadline = new Date(refDate.getTime() + (el.deadlineMaxHours + extraHours) * MS);

  if (!tracking.executionAt) {
    // لم يُقدَّم — إذا تجاوز الموعد الأقصى يأخذ 0
    return new Date() > maxDeadline ? 0 : null;
  }

  const submittedAt = new Date(tracking.executionAt);

  if (submittedAt <= idealDeadline) return 100;
  if (submittedAt <= maxDeadline) return 70;
  return 20;
}

/**
 * يحسب متوسط درجة الوقت لمجموعة عناصر (مرجَّح بحسب الأهمية)
 */
const CRITICAL_KEYS = new Set([
  'opening_report', 'closing_report',
  'supervisor_compensation', 'trainer_compensation', 'settlement',
  'medical_insurance', // التأمين الطبي حرج — تأخيره يعرّض المتدربين للخطر
]);

function calcTimingScore(relevantElements, courses) {
  const scores = [];

  for (const tracking of relevantElements) {
    const course = courses.find((c) => c.id === tracking.courseId);
    if (!course) continue;

    const score = calcElementTimeScore(tracking, course);
    if (score === null) continue; // لا يزال في الوقت، لا نحتسبه

    const weight = CRITICAL_KEYS.has(tracking.element?.key) ? 2 : 1;
    scores.push({ score, weight });
  }

  if (!scores.length) return 100; // لا عناصر مستحقة بعد = درجة كاملة
  const totalWeight = scores.reduce((s, x) => s + x.weight, 0);
  const weighted = scores.reduce((s, x) => s + x.score * x.weight, 0);
  return clampScore(weighted / totalWeight);
}

/**
 * يحسب درجة العناصر الحرجة تحديداً
 */
function calcCriticalElementsScore(relevantElements, submittedElements, courses) {
  const criticalElements = relevantElements.filter((el) => CRITICAL_KEYS.has(el.element?.key));
  if (!criticalElements.length) return 100;

  let totalScore = 0;
  let count = 0;

  for (const tracking of criticalElements) {
    const course = courses.find((c) => c.id === tracking.courseId);
    if (!course) continue;
    count++;

    // درجة الوقت (40%)
    const timeScore = calcElementTimeScore(tracking, course) ?? 100;

    // درجة الجودة (60%)
    let qualityScore = 0;
    if (tracking.status === 'APPROVED') {
      // هل مرّ من أول مرة؟ — نحدد بعدم وجود returnedAt سابق
      qualityScore = tracking.status !== 'RETURNED' && tracking.status !== 'REJECTED' ? 100 : 70;
    } else if (tracking.status === 'PENDING_APPROVAL') {
      qualityScore = 80;
    } else if (tracking.status === 'RETURNED') {
      qualityScore = 40;
    } else if (tracking.status === 'REJECTED') {
      qualityScore = 10;
    }
    // NOT_STARTED = 0

    totalScore += timeScore * 0.4 + qualityScore * 0.6;
  }

  return count ? clampScore(totalScore / count) : 100;
}

// ======================================================================
// مساعدات الفترات والأرقام
// ======================================================================

function getPeriodRange(periodType, year, value) {
  if (periodType === 'MONTHLY') {
    if (!value || value < 1 || value > 12) {
      const err = new Error('الشهر غير صحيح');
      err.statusCode = 400;
      throw err;
    }
    const start = new Date(year, value - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, value, 0, 23, 59, 59, 999);
    return { label: `${year}-${String(value).padStart(2, '0')}`, start, end };
  }

  if (periodType === 'QUARTERLY') {
    if (!value || value < 1 || value > 4) {
      const err = new Error('الربع غير صحيح');
      err.statusCode = 400;
      throw err;
    }
    const startMonth = (value - 1) * 3;
    const endMonth = startMonth + 2;
    const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
    const end = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
    return { label: `${year}-Q${value}`, start, end };
  }

  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year, 11, 31, 23, 59, 59, 999);
  return { label: `${year}`, start, end };
}

function toPercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function toAverage(values) {
  if (!values.length) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

function clampScore(value) {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Number(value.toFixed(2));
}

function getPerformanceLevel(score) {
  if (score >= 90) return 'OUTSTANDING';
  if (score >= 80) return 'VERY_GOOD';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'NEEDS_IMPROVEMENT';
  return 'WEAK';
}

function levelLabel(level) {
  const map = {
    OUTSTANDING: 'متميز',
    VERY_GOOD: 'جيد جدًا',
    GOOD: 'جيد',
    NEEDS_IMPROVEMENT: 'يحتاج تحسين',
    WEAK: 'ضعيف',
  };
  return map[level] || level;
}

// ======================================================================
// تحميل إعدادات الأوزان من قاعدة البيانات
// ======================================================================

async function loadActiveSettings() {
  const settings = await prisma.employeeKpiSetting.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  return settings || null;
}

// الأوزان الافتراضية (تُستخدم عند غياب الإعدادات)
const DEFAULT_WEIGHTS = {
  productivity: { coverage: 0.45, submission: 0.20, completion: 0.35 },
  quality: { firstPass: 0.45, returnPenalty: 0.20, rejectPenalty: 0.15, errorPenalty: 0.20 },
  speed: { submission: 0.70, resubmission: 0.30 },
  discipline: { missingCourses: 0.35, overdueElements: 0.35, staleElements: 0.30 },
  final: { productivity: 0.35, quality: 0.25, speed: 0.20, discipline: 0.20 },
};

// ======================================================================
// حالات الالتزام والانضباط
// ======================================================================

function getCommitmentStatus(params) {
  if (!params.isSubjectToEvaluation) {
    return { value: 'NOT_APPLICABLE', label: 'غير خاضع للتقييم' };
  }
  if (
    params.missingCoursesCount === 0 &&
    params.assignmentCoverageRate >= 100 &&
    params.completionRate >= 80
  ) {
    return { value: 'COMMITTED', label: 'ملتزم' };
  }
  if (params.missingCoursesCount >= 1 || params.assignmentCoverageRate < 80) {
    return { value: 'NOT_COMMITTED', label: 'غير ملتزم' };
  }
  return { value: 'NEEDS_FOLLOWUP', label: 'يحتاج متابعة' };
}

function getDisciplineStatus(params) {
  if (!params.isSubjectToEvaluation) {
    return { value: 'NOT_APPLICABLE', label: 'غير خاضع للتقييم' };
  }
  if (
    params.overdueElementsRate <= 10 &&
    params.stalePendingElementsRate <= 10 &&
    params.returnRate <= 15 &&
    params.rejectRate <= 5
  ) {
    return { value: 'DISCIPLINED', label: 'منضبط' };
  }
  if (
    params.overdueElementsRate > 25 ||
    params.stalePendingElementsRate > 25 ||
    params.returnRate > 25 ||
    params.rejectRate > 10
  ) {
    return { value: 'UNDISCIPLINED', label: 'غير منضبط' };
  }
  return { value: 'NEEDS_FOLLOWUP', label: 'يحتاج متابعة' };
}

// ======================================================================
// حساب النقاط المرجّحة بأوزان ديناميكية
// ======================================================================

function calculateWeightedScores(metrics, weights = DEFAULT_WEIGHTS) {
  if (!metrics.isSubjectToEvaluation) {
    return { productivityScore: 0, speedScore: 0, qualityScore: 0, disciplineScore: 0, finalScore: 0 };
  }

  const w = weights;

  const coverageScore = Math.max(
    0,
    metrics.assignmentCoverageRate - metrics.missingCoursesRate * 0.5,
  );

  const productivityScore =
    coverageScore * w.productivity.coverage +
    metrics.submissionRate * w.productivity.submission +
    metrics.completionRate * w.productivity.completion;

  const qualityScore =
    metrics.firstPassSubmissionRate * w.quality.firstPass +
    (100 - metrics.returnRate) * w.quality.returnPenalty +
    (100 - metrics.rejectRate) * w.quality.rejectPenalty +
    (100 - metrics.operationalErrorRate) * w.quality.errorPenalty;

  const elementSubmissionScore = Math.max(0, 100 - metrics.avgElementSubmissionHours * 2);
  const resubmissionScore = Math.max(0, 100 - metrics.avgResubmissionHours * 2.5);
  const speedScore = elementSubmissionScore * w.speed.submission + resubmissionScore * w.speed.resubmission;

  const disciplineScore =
    (100 - metrics.missingCoursesRate) * w.discipline.missingCourses +
    (100 - metrics.overdueElementsRate) * w.discipline.overdueElements +
    (100 - metrics.stalePendingElementsRate) * w.discipline.staleElements;

  const finalScore =
    productivityScore * w.final.productivity +
    qualityScore * w.final.quality +
    speedScore * w.final.speed +
    disciplineScore * w.final.discipline;

  return {
    productivityScore: clampScore(productivityScore),
    speedScore: clampScore(speedScore),
    qualityScore: clampScore(qualityScore),
    disciplineScore: clampScore(disciplineScore),
    finalScore: clampScore(finalScore),
  };
}

// ======================================================================
// بناء نموذج العرض
// ======================================================================

function buildViewModel(base) {
  const isSubjectToEvaluation = !(base.assignedCoursesCount === 0 && base.actualCoursesCount === 0);

  const commitmentStatus = getCommitmentStatus({
    isSubjectToEvaluation,
    assignmentCoverageRate: base.assignmentCoverageRate,
    missingCoursesCount: base.missingCoursesCount,
    completionRate: base.closureCompletionRate,
  });

  const disciplineStatus = getDisciplineStatus({
    isSubjectToEvaluation,
    overdueElementsRate: base.overdueElementsRate,
    stalePendingElementsRate: base.stalePendingElementsRate,
    returnRate: base.returnRate,
    rejectRate: base.rejectRate,
  });

  return {
    isSubjectToEvaluation,
    commitmentStatus: commitmentStatus.value,
    commitmentStatusLabel: commitmentStatus.label,
    disciplineStatus: disciplineStatus.value,
    disciplineStatusLabel: disciplineStatus.label,
    performanceLevelLabel: isSubjectToEvaluation
      ? levelLabel(base.performanceLevel)
      : 'غير خاضع للتقييم',
    finalScoreDisplay: isSubjectToEvaluation ? base.finalScore : null,
  };
}

// ======================================================================
// تفاصيل الأداء حسب نوع عنصر الإقفال
// ======================================================================

function buildElementBreakdown(relevantCourses, relevantElements) {
  const byType = {};

  for (const el of relevantElements) {
    const key  = el.element?.key  || 'unknown';
    const name = el.element?.name || key;

    if (!byType[key]) {
      byType[key] = {
        key, name,
        total: 0, submitted: 0, approved: 0,
        returned: 0, rejected: 0, pending: 0, notStarted: 0,
        // ── تفصيل التوقيت ─────────────────────────────────────
        beforeIdeal: 0,   // قبل الموعد المثالي (درجة 100)
        beforeMax:   0,   // بعد المثالي لكن قبل الأقصى (درجة 70)
        afterMax:    0,   // بعد الموعد الأقصى (درجة 20)
        submissionHours: [],
      };
    }

    const entry = byType[key];
    entry.total += 1;

    switch (el.status) {
      case 'APPROVED':         entry.approved += 1; entry.submitted += 1; break;
      case 'RETURNED':         entry.returned += 1; entry.submitted += 1; break;
      case 'REJECTED':         entry.rejected += 1; entry.submitted += 1; break;
      case 'PENDING_APPROVAL': entry.pending  += 1; entry.submitted += 1; break;
      default:                 entry.notStarted += 1;
    }

    // تصنيف التوقيت
    const course = relevantCourses.find((c) => c.id === el.courseId);
    if (course && el.executionAt && el.element?.deadlineRefPoint) {
      const e = el.element;
      const MS = 1000 * 60 * 60;
      const refDate = e.deadlineRefPoint === 'START'
        ? new Date(course.startDate)
        : new Date(course.endDate);
      const idealDeadline = new Date(refDate.getTime() + e.deadlineIdealHours * MS);
      const maxDeadline   = new Date(refDate.getTime() + ((e.deadlineMaxHours || e.deadlineIdealHours) + (el.extensionHours || 0)) * MS);
      const submittedAt   = new Date(el.executionAt);

      if (submittedAt <= idealDeadline)   entry.beforeIdeal += 1;
      else if (submittedAt <= maxDeadline) entry.beforeMax  += 1;
      else                                entry.afterMax    += 1;

      // حساب الفرق من تاريخ بداية/نهاية الدورة (وليس createdAt)
      const refForCalc = new Date(course.startDate);
      const hours = Math.max(0, (submittedAt.getTime() - refForCalc.getTime()) / MS);
      entry.submissionHours.push(hours);
    } else if (course && el.executionAt) {
      const hours = Math.max(
        0,
        (new Date(el.executionAt).getTime() - new Date(course.startDate).getTime()) / (1000 * 60 * 60),
      );
      entry.submissionHours.push(hours);
    }
  }

  return Object.values(byType).map((entry) => {
    const timedTotal = entry.beforeIdeal + entry.beforeMax + entry.afterMax;
    return {
      key:           entry.key,
      name:          entry.name,
      total:         entry.total,
      submitted:     entry.submitted,
      approved:      entry.approved,
      returned:      entry.returned,
      rejected:      entry.rejected,
      pending:       entry.pending,
      notStarted:    entry.notStarted,
      // تفصيل التوقيت — أعداد وليس نسب فقط
      beforeIdeal:      entry.beforeIdeal,
      beforeMax:        entry.beforeMax,
      afterMax:         entry.afterMax,
      beforeIdealRate:  timedTotal > 0 ? toPercent(entry.beforeIdeal, timedTotal) : null,
      beforeMaxRate:    timedTotal > 0 ? toPercent(entry.beforeMax,   timedTotal) : null,
      afterMaxRate:     timedTotal > 0 ? toPercent(entry.afterMax,    timedTotal) : null,
      // متوسط الوقت بالساعات (يُحوَّل للعرض في الواجهة)
      avgSubmissionHours: toAverage(entry.submissionHours),
      submissionRate:     toPercent(entry.submitted, entry.total),
      approvalRate:       toPercent(entry.approved,  entry.submitted),
      returnRate:         toPercent(entry.returned,  entry.submitted),
      rejectRate:         toPercent(entry.rejected,  entry.submitted),
    };
  });
}

// ======================================================================
// توليد رؤى ذكية باللغة العربية
// ======================================================================

function generateInsights(metrics, scores, elementBreakdown = []) {
  const insights = [];

  if (!metrics.isSubjectToEvaluation) {
    return [{ type: 'info', text: 'الموظف غير خاضع للتقييم في هذه الفترة لعدم وجود دورات.' }];
  }

  // رؤية الإنتاجية
  if (scores.productivityScore >= 85) {
    insights.push({ type: 'positive', text: 'إنتاجية عالية: يُكمل الموظف نسبة كبيرة من عناصر الإقفال المطلوبة.' });
  } else if (scores.productivityScore < 60) {
    insights.push({ type: 'warning', text: `إنتاجية منخفضة (${scores.productivityScore}): نسبة إتمام عناصر الإقفال ${metrics.completionRate}% فقط، يُنصح بمتابعة الموظف.` });
  }

  // رؤية الجودة
  if (scores.qualityScore >= 85) {
    insights.push({ type: 'positive', text: `جودة تقديم ممتازة: نسبة القبول من أول مرة ${metrics.firstPassSubmissionRate}%.` });
  } else if (metrics.returnRate > 25) {
    insights.push({ type: 'warning', text: `نسبة الإرجاع مرتفعة (${metrics.returnRate}%): قد تشير إلى ضعف في جودة إعداد العناصر قبل التقديم.` });
  }
  if (metrics.rejectRate > 10) {
    insights.push({ type: 'critical', text: `نسبة الرفض مرتفعة (${metrics.rejectRate}%): تستوجب مراجعة فورية لأسباب الرفض.` });
  }

  // رؤية السرعة
  if (metrics.avgElementSubmissionHours > 0) {
    if (metrics.avgElementSubmissionHours < 24) {
      insights.push({ type: 'positive', text: `سرعة تقديم ممتازة: متوسط ${Math.round(metrics.avgElementSubmissionHours)} ساعة لتقديم العناصر.` });
    } else if (metrics.avgElementSubmissionHours > 120) {
      insights.push({ type: 'warning', text: `بطء في التقديم: متوسط ${Math.round(metrics.avgElementSubmissionHours / 24)} يوم لتقديم العنصر، يُنصح بالتقديم مبكراً.` });
    }
  }

  // رؤية الانضباط
  if (metrics.overdueElementsCount > 0) {
    insights.push({ type: 'critical', text: `يوجد ${metrics.overdueElementsCount} عنصر متأخر على دورات انتهت، يستوجب متابعة عاجلة.` });
  }
  if (metrics.stalePendingElementsCount > 0) {
    insights.push({ type: 'warning', text: `يوجد ${metrics.stalePendingElementsCount} عنصر راكد لم يُحرَّك منذ أكثر من 3 أيام.` });
  }
  if (metrics.missingCoursesCount > 0) {
    insights.push({ type: 'warning', text: `${metrics.missingCoursesCount} دورة مُسندة لم تُسجَّل في النظام بعد.` });
  }

  // رؤية من تفصيل العناصر
  if (elementBreakdown.length > 0) {
    const weakElements = elementBreakdown.filter(
      (el) => el.total > 0 && el.approvalRate < 70 && el.submitted > 0,
    );
    if (weakElements.length > 0) {
      const names = weakElements.map((e) => e.name).join('، ');
      insights.push({ type: 'warning', text: `عناصر تحتاج اهتماماً: ${names} — نسبة القبول أقل من 70%.` });
    }

    const strongElements = elementBreakdown.filter(
      (el) => el.total > 0 && el.approvalRate >= 90 && el.submitted >= el.total * 0.8,
    );
    if (strongElements.length > 0) {
      const names = strongElements.map((e) => e.name).join('، ');
      insights.push({ type: 'positive', text: `أداء متميز في: ${names}.` });
    }
  }

  // رؤية إجمالية
  if (scores.finalScore >= 90) {
    insights.push({ type: 'positive', text: 'أداء إجمالي متميز — الموظف يستحق التقدير في هذه الفترة.' });
  } else if (scores.finalScore < 60) {
    insights.push({ type: 'critical', text: 'الأداء الإجمالي دون المستوى المقبول — يُنصح بجلسة متابعة مع المشرف.' });
  }

  return insights;
}

// ======================================================================
// حساب مقاييس الموظف الشاملة
// ======================================================================

function computeEmployeeMetrics(relevantCourses, relevantElements) {
  const now = new Date();

  const submittedElements = relevantElements.filter((el) => !!el.executionAt);
  const approvedElements = relevantElements.filter((el) => el.status === 'APPROVED');
  const returnedElements = relevantElements.filter((el) => el.status === 'RETURNED');
  const rejectedElements = relevantElements.filter((el) => el.status === 'REJECTED');
  const pendingApprovalElements = relevantElements.filter((el) => el.status === 'PENDING_APPROVAL');
  const completedElements = [...approvedElements, ...pendingApprovalElements];

  // عناصر متأخرة: الدورة انتهت والعنصر لم يُقدَّم
  const overdueElements = relevantElements.filter((el) => {
    if (el.status !== 'NOT_STARTED' && el.status !== 'RETURNED') return false;
    const course = relevantCourses.find((c) => c.id === el.courseId);
    return course && new Date(course.endDate) < now;
  });

  // عناصر راكدة: مضى 3 أيام دون تحريك
  const stalePendingElements = relevantElements.filter((el) => {
    if (el.status !== 'NOT_STARTED' && el.status !== 'RETURNED') return false;
    const course = relevantCourses.find((c) => c.id === el.courseId);
    const baseDate =
      el.status === 'RETURNED' && el.decisionAt
        ? new Date(el.decisionAt)
        : course?.createdAt;
    if (!baseDate) return false;
    return (now.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60) > 72;
  });

  // عناصر قُبلت من أول مرة (لم تُرجع أو تُرفض في أي وقت)
  // نحدد بأن العنصر "مرّ من أول مرة" إذا كان مقدَّماً ولا يوجد له تاريخ قرار سابق أو كان القرار هو الموافقة مباشرة
  const firstPassElements = submittedElements.filter(
    (el) => el.returnedElementsCount === 0 && el.rejectedElementsCount === 0 &&
    el.status !== 'RETURNED' && el.status !== 'REJECTED',
  );

  // ساعات التقديم (من إنشاء الدورة لحظة التقديم)
  const elementSubmissionHours = submittedElements.map((el) => {
    const course = relevantCourses.find((c) => c.id === el.courseId);
    if (!course || !el.executionAt) return 0;
    return Math.max(0, (new Date(el.executionAt).getTime() - new Date(course.createdAt).getTime()) / (1000 * 60 * 60));
  });

  // ساعات إعادة التقديم بعد الإرجاع
  const resubmissionHours = submittedElements
    .filter((el) => el.decisionAt && el.executionAt && (el.status === 'RETURNED' || el.status === 'APPROVED'))
    .map((el) => {
      const diff = new Date(el.executionAt).getTime() - new Date(el.decisionAt).getTime();
      return Math.max(0, diff / (1000 * 60 * 60));
    });

  // متوسط تأخر إقفال الدورات (من تاريخ الانتهاء لتاريخ الإقفال الفعلي)
  const courseClosureDelayDays = relevantCourses
    .filter((c) => c.status === 'CLOSED' || c.status === 'ARCHIVED')
    .map((c) => {
      if (!c.updatedAt || !c.endDate) return 0;
      const delay = (new Date(c.updatedAt).getTime() - new Date(c.endDate).getTime()) / (1000 * 60 * 60 * 24);
      return Math.max(0, delay);
    });

  return {
    submittedElements,
    approvedElements,
    returnedElements,
    rejectedElements,
    pendingApprovalElements,
    completedElements,
    overdueElements,
    stalePendingElements,
    firstPassElements,
    elementSubmissionHours,
    resubmissionHours,
    courseClosureDelayDays,
  };
}

// ======================================================================
// حساب وحفظ لقطات الأداء
// ======================================================================

async function calculateAndStore(periodType, year, value, managerId, startOverride, endOverride, labelOverride) {
  const range = labelOverride
    ? { label: labelOverride, start: startOverride, end: endOverride }
    : getPeriodRange(periodType, year, value);
  const { label, start, end } = range;

  const [employees, activeSettings] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, roles: { has: 'EMPLOYEE' } },
      include: { operationalProject: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    loadActiveSettings(),
  ]);

  const weights = activeSettings
    ? {
        productivity: {
          coverage: activeSettings.closureCompletionWeight / 100,
          submission: activeSettings.overdueClosuresWeight / 100,
          completion: activeSettings.avgCourseClosureWeight / 100,
        },
        quality: {
          firstPass: activeSettings.firstPassApprovalWeight / 100,
          returnPenalty: activeSettings.returnRateWeight / 100,
          rejectPenalty: activeSettings.rejectRateWeight / 100,
          errorPenalty: activeSettings.errorRateWeight / 100,
        },
        speed: {
          submission: activeSettings.avgElementSubmissionWeight / 100,
          resubmission: activeSettings.avgResubmissionWeight / 100,
        },
        discipline: {
          missingCourses: activeSettings.overdueCoursesWeight / 100,
          overdueElements: activeSettings.overdueElementsWeight / 100,
          staleElements: activeSettings.staleElementsWeight / 100,
        },
        final: DEFAULT_WEIGHTS.final,
      }
    : DEFAULT_WEIGHTS;

  const employeeIds = employees.map((e) => e.id);

  // تحميل مشرفي المشاريع مرة واحدة — لإرسال تنبيهات الدرجة المنخفضة
  const allSupervisors = await prisma.projectSupervisor.findMany({
    select: { userId: true, operationalProjectId: true },
  });
  const supervisorsByProject = new Map();
  for (const s of allSupervisors) {
    const arr = supervisorsByProject.get(s.operationalProjectId) || [];
    arr.push(s.userId);
    supervisorsByProject.set(s.operationalProjectId, arr);
  }

  const [assignments, courses, optionalReportGroups] = await Promise.all([
    prisma.courseAssignmentRegister.findMany({
      where: { periodType, periodLabel: label, userId: { in: employeeIds } },
    }),
    prisma.course.findMany({
      where: {
        primaryEmployeeId: { in: employeeIds },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      include: { closureElements: { include: { element: true } } },
    }),
    // عدد التقارير الاختيارية لكل موظف في الفترة
    prisma.courseOptionalReport.groupBy({
      by: ['authorId'],
      where: { authorId: { in: employeeIds }, createdAt: { gte: start, lte: end } },
      _count: { id: true },
    }).catch(() => []),
  ]);

  // خريطة عدد التقارير الاختيارية بالموظف
  const optionalReportMap = new Map(
    optionalReportGroups.map((g) => [g.authorId, g._count.id])
  );

  const assignmentMap = new Map(assignments.map((a) => [a.userId, a]));
  const coursesByEmployee = new Map();
  for (const course of courses) {
    const arr = coursesByEmployee.get(course.primaryEmployeeId) || [];
    arr.push(course);
    coursesByEmployee.set(course.primaryEmployeeId, arr);
  }

  const snapshots = [];

  for (const employee of employees) {
    const assignment = assignmentMap.get(employee.id);
    const relevantCourses = coursesByEmployee.get(employee.id) || [];
    const relevantElements = relevantCourses.flatMap((c) =>
      (c.closureElements || []).filter((el) => el.status !== 'NOT_APPLICABLE'),
    );

    const computed = computeEmployeeMetrics(relevantCourses, relevantElements);

    // درجات الوقت والعناصر الحرجة بناءً على المواعيد الفعلية
    const timingScore   = calcTimingScore(relevantElements, relevantCourses);
    const criticalScore = calcCriticalElementsScore(relevantElements, computed.submittedElements, relevantCourses);

    // مكافأة الدورات العابرة للمشاريع
    const crossProjectCourses = relevantCourses.filter(c => c.isCrossProject);
    const crossProjectCount   = crossProjectCourses.length;
    const crossProjectBonus   = crossProjectCount > 0
      ? Math.min(10, crossProjectCount * 3) // حد أقصى +10 نقاط
      : 0;

    const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
    const actualCoursesCount = relevantCourses.length;
    // إصلاح حرج: عندما لا يُسجّل المدير إسناداً (=0)، لا نُعاقب الموظف
    // يُعامَل الإسناد كـ 100% تغطية ولا توجد دورات ناقصة
    const effectiveAssigned = assignedCoursesCount === 0 ? actualCoursesCount : assignedCoursesCount;
    const missingCoursesCount = assignedCoursesCount === 0 ? 0 : Math.max(assignedCoursesCount - actualCoursesCount, 0);
    const extraCoursesCount   = assignedCoursesCount === 0 ? 0 : Math.max(actualCoursesCount - assignedCoursesCount, 0);
    const assignmentCoverageRate = effectiveAssigned === 0 ? 0 : toPercent(actualCoursesCount, effectiveAssigned);
    const isSubjectToEvaluation = actualCoursesCount > 0;

    const metrics = {
      isSubjectToEvaluation,
      requiredElementsCount: relevantElements.length,
      completedElementsCount: computed.completedElements.length,
      closureCompletionRate: toPercent(computed.completedElements.length, relevantElements.length),
      submittedElementsCount: computed.submittedElements.length,
      approvedElementsCount: computed.approvedElements.length,
      returnedElementsCount: computed.returnedElements.length,
      rejectedElementsCount: computed.rejectedElements.length,
      submissionRate: toPercent(computed.submittedElements.length, relevantElements.length),
      firstPassSubmissionRate: toPercent(
        computed.submittedElements.filter((el) => el.status !== 'RETURNED' && el.status !== 'REJECTED').length,
        computed.submittedElements.length,
      ),
      returnRate: toPercent(computed.returnedElements.length, computed.submittedElements.length),
      rejectRate: toPercent(computed.rejectedElements.length, computed.submittedElements.length),
      operationalErrorRate: toPercent(
        computed.returnedElements.length + computed.rejectedElements.length,
        computed.submittedElements.length,
      ),
      avgElementSubmissionHours: toAverage(computed.elementSubmissionHours),
      avgResubmissionHours: toAverage(computed.resubmissionHours),
      avgCourseClosureDelayDays: toAverage(computed.courseClosureDelayDays),
      overdueElementsCount: computed.overdueElements.length,
      overdueElementsRate: toPercent(computed.overdueElements.length, relevantElements.length),
      stalePendingElementsCount: computed.stalePendingElements.length,
      stalePendingElementsRate: toPercent(computed.stalePendingElements.length, relevantElements.length),
      assignmentCoverageRate,
      missingCoursesRate: toPercent(missingCoursesCount, assignedCoursesCount),
    };

    const rawScores = calculateWeightedScores({
      isSubjectToEvaluation: metrics.isSubjectToEvaluation,
      assignmentCoverageRate: metrics.assignmentCoverageRate,
      missingCoursesRate: metrics.missingCoursesRate,
      submissionRate: metrics.submissionRate,
      completionRate: metrics.closureCompletionRate,
      firstPassSubmissionRate: metrics.firstPassSubmissionRate,
      returnRate: metrics.returnRate,
      rejectRate: metrics.rejectRate,
      operationalErrorRate: metrics.operationalErrorRate,
      avgElementSubmissionHours: metrics.avgElementSubmissionHours,
      avgResubmissionHours: metrics.avgResubmissionHours,
      overdueElementsRate: metrics.overdueElementsRate,
      stalePendingElementsRate: metrics.stalePendingElementsRate,
    }, weights);

    // ── مكافأة التقارير الاختيارية ───────────────────────────────
    // المنطق: كل تقرير اختياري مقدّم = +0.5 نقطة (حد أقصى +5)
    // لا يُعاقَب الموظف على عدم التقديم — المكافأة فقط
    const optionalReportsCount = optionalReportMap.get(employee.id) || 0;
    const totalCoursesCount    = relevantCourses.length || 1;
    // نسبة التغطية: كم تقرير لكل دورة (بحد أقصى ١ لكل دورة لمنع الحشو)
    const reportCoverage   = Math.min(1, optionalReportsCount / totalCoursesCount);
    const reportBonusScore = parseFloat((reportCoverage * 5).toFixed(2)); // 0 → 5

    // دمج المؤشرات الستة بالأوزان المعتمدة
    const baseScore =
      rawScores.productivityScore * 0.25 +
      timingScore                 * 0.20 +
      rawScores.qualityScore      * 0.20 +
      criticalScore               * 0.20 +
      rawScores.speedScore        * 0.10 +
      rawScores.disciplineScore   * 0.05 +
      crossProjectBonus;

    const scores = isSubjectToEvaluation ? {
      productivityScore:    rawScores.productivityScore,
      timelinessScore:      clampScore(timingScore),
      qualityScore:         rawScores.qualityScore,
      criticalScore:        clampScore(criticalScore),
      responsivenessScore:  rawScores.speedScore,
      disciplineScore:      rawScores.disciplineScore,
      crossProjectCount,
      crossProjectBonus,
      reportBonusScore,
      // الدرجة النهائية = الأوزان الستة + مكافأة التقارير + مكافأة الدورات العابرة
      finalScore: clampScore(baseScore + reportBonusScore),
    } : { ...rawScores, reportBonusScore: 0 };

    const performanceLevel = getPerformanceLevel(scores.finalScore);

    const snapshotData = {
      periodStart: start,
      periodEnd: end,
      requiredElementsCount: metrics.requiredElementsCount,
      completedElementsCount: metrics.completedElementsCount,
      closureCompletionRate: metrics.closureCompletionRate,
      dueCoursesCount: assignedCoursesCount,
      closedCoursesCount: actualCoursesCount,
      dueCourseClosureRate: metrics.assignmentCoverageRate,
      submittedElementsCount: metrics.submittedElementsCount,
      approvedElementsCount: metrics.approvedElementsCount,
      returnedElementsCount: metrics.returnedElementsCount,
      rejectedElementsCount: metrics.rejectedElementsCount,
      firstPassApprovalRate: metrics.firstPassSubmissionRate,
      returnRate: metrics.returnRate,
      rejectRate: metrics.rejectRate,
      operationalErrorRate: metrics.operationalErrorRate,
      avgElementSubmissionHours: metrics.avgElementSubmissionHours,
      avgResubmissionHours: metrics.avgResubmissionHours,
      avgCourseClosureDelayDays: metrics.avgCourseClosureDelayDays,
      overdueCoursesCount: missingCoursesCount,
      overdueCoursesRate: metrics.missingCoursesRate,
      overdueElementsCount: metrics.overdueElementsCount,
      overdueElementsRate: metrics.overdueElementsRate,
      stalePendingElementsCount: metrics.stalePendingElementsCount,
      stalePendingElementsRate: metrics.stalePendingElementsRate,
      productivityScore: scores.productivityScore,
      timelinessScore:   scores.timelinessScore ?? 0,
      qualityScore:      scores.qualityScore,
      criticalScore:     scores.criticalScore ?? 0,
      speedScore:        scores.responsivenessScore ?? scores.speedScore,
      disciplineScore:   scores.disciplineScore,
      reportBonusScore:  scores.reportBonusScore ?? 0,
      finalScore:        scores.finalScore,
      performanceLevel,
      settingsId: activeSettings?.id || null,
    };

    const snapshot = await prisma.employeeKpiSnapshot.upsert({
      where: {
        userId_periodType_periodLabel: { userId: employee.id, periodType, periodLabel: label },
      },
      update: snapshotData,
      create: { userId: employee.id, periodType, periodLabel: label, ...snapshotData },
      include: { user: { include: { operationalProject: true } } },
    });

    const viewModel = buildViewModel({
      assignedCoursesCount,
      actualCoursesCount,
      missingCoursesCount,
      extraCoursesCount,
      assignmentCoverageRate,
      closureCompletionRate: metrics.closureCompletionRate,
      submissionRate: metrics.submissionRate,
      overdueElementsRate: metrics.overdueElementsRate,
      stalePendingElementsRate: metrics.stalePendingElementsRate,
      returnRate: metrics.returnRate,
      rejectRate: metrics.rejectRate,
      performanceLevel: snapshot.performanceLevel,
      finalScore: snapshot.finalScore,
    });

    // تنبيه مشرفي المشروع حين تقل الدرجة عن 60%
    if (isSubjectToEvaluation && scores.finalScore < 60) {
      const supervisorIds = supervisorsByProject.get(employee.operationalProjectId) || [];
      const employeeName = `${employee.firstName} ${employee.lastName}`;
      for (const supId of supervisorIds) {
        await createNotification(
          supId,
          'EMPLOYEE_LOW_SCORE',
          `تنبيه أداء: ${employeeName}`,
          `حصل الموظف ${employeeName} على درجة ${scores.finalScore.toFixed(1)}% في فترة ${label} — أقل من الحد المقبول 60%. يُنصح بجلسة متابعة.`,
          { userId: employee.id, periodLabel: label, periodType, score: scores.finalScore },
        );
      }
    }

    snapshots.push({
      id: snapshot.id,
      userId: snapshot.userId,
      employeeName: `${snapshot.user.firstName} ${snapshot.user.lastName}`,
      projectName: snapshot.user.operationalProject?.name || '-',
      assignedCoursesCount,
      actualCoursesCount,
      missingCoursesCount,
      extraCoursesCount,
      courseRegistrationCoverageRate: assignmentCoverageRate,
      finalScore: snapshot.finalScore,
      performanceLevel: levelLabel(snapshot.performanceLevel),
      closureCompletionRate: snapshot.closureCompletionRate,
      submissionRate: metrics.submissionRate,
      firstPassApprovalRate: snapshot.firstPassApprovalRate,
      returnRate: snapshot.returnRate,
      rejectRate: snapshot.rejectRate,
      overdueCoursesRate: snapshot.overdueCoursesRate,
      avgCourseClosureDelayDays: snapshot.avgCourseClosureDelayDays,
      productivityScore: snapshot.productivityScore,
      speedScore: snapshot.speedScore,
      qualityScore: snapshot.qualityScore,
      disciplineScore: snapshot.disciplineScore,
      ...viewModel,
    });
  }

  await logAudit(managerId, 'MANAGER', 'KPI_SNAPSHOTS_CALCULATED', {
    periodType,
    periodLabel: label,
    employeesCount: snapshots.length,
  });

  return {
    periodType,
    periodLabel: label,
    periodStart: start,
    periodEnd: end,
    employeesCount: snapshots.length,
    settingsUsed: activeSettings ? { id: activeSettings.id, name: activeSettings.name } : null,
    results: snapshots.sort((a, b) => {
      if (a.isSubjectToEvaluation !== b.isSubjectToEvaluation) return a.isSubjectToEvaluation ? -1 : 1;
      return (b.finalScoreDisplay ?? -1) - (a.finalScoreDisplay ?? -1);
    }),
  };
}

// ======================================================================
// جلب اللقطات مع فلتر الصلاحيات
// ======================================================================

async function getSnapshots(periodType, periodLabel, context = {}) {
  const { activeRole, userId, supervisedProjectIds = [] } = context;

  const userFilter =
    activeRole === 'MANAGER' || activeRole === 'QUALITY_VIEWER'
      ? { isActive: true }
      : activeRole === 'PROJECT_SUPERVISOR'
      ? { isActive: true, operationalProjectId: { in: supervisedProjectIds } }
      : { isActive: true, id: userId };

  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: {
      ...(periodType ? { periodType } : {}),
      ...(periodLabel ? { periodLabel } : {}),
      user: userFilter,
    },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ finalScore: 'desc' }, { createdAt: 'desc' }],
  });

  if (!snapshots.length) return [];

  const userIds = [...new Set(snapshots.map((s) => s.userId))];
  const periodStarts = snapshots.map((s) => s.periodStart);
  const periodEnds = snapshots.map((s) => s.periodEnd);
  const globalStart = new Date(Math.min(...periodStarts.map((d) => new Date(d).getTime())));
  const globalEnd = new Date(Math.max(...periodEnds.map((d) => new Date(d).getTime())));

  const [assignments, courses] = await Promise.all([
    prisma.courseAssignmentRegister.findMany({
      where: {
        userId: { in: userIds },
        ...(periodType ? { periodType } : {}),
        ...(periodLabel ? { periodLabel } : {}),
      },
    }),
    prisma.course.findMany({
      where: {
        primaryEmployeeId: { in: userIds },
        startDate: { lte: globalEnd },
        endDate: { gte: globalStart },
      },
      select: { id: true, primaryEmployeeId: true, startDate: true, endDate: true },
    }),
  ]);

  const assignmentMap = new Map(
    assignments.map((a) => [`${a.userId}::${a.periodType}::${a.periodLabel}`, a]),
  );
  const coursesByEmployee = new Map();
  for (const course of courses) {
    const arr = coursesByEmployee.get(course.primaryEmployeeId) || [];
    arr.push(course);
    coursesByEmployee.set(course.primaryEmployeeId, arr);
  }

  // ترتيب ضمن المشروع لإضافة الترتيب التقريبي
  const projectGroups = new Map();
  for (const snap of snapshots) {
    const projId = snap.user?.operationalProject?.id || 'none';
    const group = projectGroups.get(projId) || [];
    group.push(snap);
    projectGroups.set(projId, group);
  }

  const enriched = snapshots.map((snapshot, idx) => {
    const assignment = assignmentMap.get(`${snapshot.userId}::${snapshot.periodType}::${snapshot.periodLabel}`);
    const relevantCourses = (coursesByEmployee.get(snapshot.userId) || []).filter(
      (c) => new Date(c.startDate) <= new Date(snapshot.periodEnd) && new Date(c.endDate) >= new Date(snapshot.periodStart),
    );

    const actualCoursesCount = relevantCourses.length;
    const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
    const effectiveAssigned2 = assignedCoursesCount === 0 ? actualCoursesCount : assignedCoursesCount;
    const missingCoursesCount = assignedCoursesCount === 0 ? 0 : Math.max(assignedCoursesCount - actualCoursesCount, 0);
    const extraCoursesCount   = assignedCoursesCount === 0 ? 0 : Math.max(actualCoursesCount - assignedCoursesCount, 0);
    const assignmentCoverageRate = effectiveAssigned2 === 0 ? 0 : toPercent(actualCoursesCount, effectiveAssigned2);

    const vm = buildViewModel({
      assignedCoursesCount,
      actualCoursesCount,
      missingCoursesCount,
      extraCoursesCount,
      assignmentCoverageRate,
      closureCompletionRate: snapshot.closureCompletionRate,
      submissionRate: toPercent(snapshot.submittedElementsCount, snapshot.requiredElementsCount),
      overdueElementsRate: snapshot.overdueElementsRate,
      stalePendingElementsRate: snapshot.stalePendingElementsRate,
      returnRate: snapshot.returnRate,
      rejectRate: snapshot.rejectRate,
      performanceLevel: snapshot.performanceLevel,
      finalScore: snapshot.finalScore,
    });

    return {
      ...snapshot,
      assignedCoursesCount,
      actualCoursesCount,
      missingCoursesCount,
      extraCoursesCount,
      courseRegistrationCoverageRate: assignmentCoverageRate,
      overallRank: idx + 1,
      ...vm,
    };
  });

  return enriched.sort((a, b) => {
    if (a.isSubjectToEvaluation !== b.isSubjectToEvaluation) return a.isSubjectToEvaluation ? -1 : 1;
    return (b.finalScoreDisplay ?? -1) - (a.finalScoreDisplay ?? -1);
  });
}

// ======================================================================
// تفاصيل لقطة موظف — النسخة المعززة
// ======================================================================

async function getEmployeeSnapshotDetails(userId, periodType, periodLabel, context = {}) {
  const { activeRole, userId: requesterId, supervisedProjectIds = [] } = context;

  // فلتر الصلاحيات
  if (activeRole === 'EMPLOYEE' && userId !== requesterId) {
    const err = new Error('غير مصرح لك بالاطلاع على بيانات موظف آخر');
    err.statusCode = 403;
    throw err;
  }
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { operationalProjectId: true },
    });
    if (!target || !supervisedProjectIds.includes(target.operationalProjectId)) {
      const err = new Error('هذا الموظف ليس ضمن مشاريعك المشرف عليها');
      err.statusCode = 403;
      throw err;
    }
  }

  const snapshot = await prisma.employeeKpiSnapshot.findUnique({
    where: { userId_periodType_periodLabel: { userId, periodType, periodLabel } },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!snapshot || !snapshot.user?.isActive) {
    const err = new Error('لا توجد بيانات KPI لهذه الفترة');
    err.statusCode = 404;
    throw err;
  }

  const [assignment, actualCoursesCount, courses] = await Promise.all([
    prisma.courseAssignmentRegister.findUnique({
      where: { userId_periodType_periodLabel: { userId, periodType, periodLabel } },
    }),
    prisma.course.count({
      where: {
        primaryEmployeeId: userId,
        startDate: { lte: snapshot.periodEnd },
        endDate: { gte: snapshot.periodStart },
      },
    }),
    prisma.course.findMany({
      where: {
        primaryEmployeeId: userId,
        startDate: { lte: snapshot.periodEnd },
        endDate: { gte: snapshot.periodStart },
      },
      include: { closureElements: { include: { element: true } } },
    }),
  ]);

  const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
  const effectiveAssigned3 = assignedCoursesCount === 0 ? actualCoursesCount : assignedCoursesCount;
  const missingCoursesCount = assignedCoursesCount === 0 ? 0 : Math.max(assignedCoursesCount - actualCoursesCount, 0);
  const extraCoursesCount   = assignedCoursesCount === 0 ? 0 : Math.max(actualCoursesCount - assignedCoursesCount, 0);
  const assignmentCoverageRate = effectiveAssigned3 === 0 ? 0 : toPercent(actualCoursesCount, effectiveAssigned3);

  // تفاصيل حسب نوع العنصر
  const relevantElements = courses.flatMap((c) =>
    (c.closureElements || []).filter((el) => el.status !== 'NOT_APPLICABLE'),
  );
  const elementBreakdown = buildElementBreakdown(courses, relevantElements);

  // الرؤى الذكية
  const metricsForInsights = {
    isSubjectToEvaluation: !(assignedCoursesCount === 0 && actualCoursesCount === 0),
    completionRate: snapshot.closureCompletionRate,
    firstPassSubmissionRate: snapshot.firstPassApprovalRate,
    returnRate: snapshot.returnRate,
    rejectRate: snapshot.rejectRate,
    avgElementSubmissionHours: snapshot.avgElementSubmissionHours,
    overdueElementsCount: snapshot.overdueElementsCount,
    stalePendingElementsCount: snapshot.stalePendingElementsCount,
    missingCoursesCount,
  };
  const scoresForInsights = {
    finalScore: snapshot.finalScore,
    productivityScore: snapshot.productivityScore,
    qualityScore: snapshot.qualityScore,
    speedScore: snapshot.speedScore,
    disciplineScore: snapshot.disciplineScore,
  };
  const insights = generateInsights(metricsForInsights, scoresForInsights, elementBreakdown);

  return {
    ...snapshot,
    assignedCoursesCount,
    actualCoursesCount,
    missingCoursesCount,
    extraCoursesCount,
    courseRegistrationCoverageRate: assignmentCoverageRate,
    assignmentNotes: assignment?.notes || null,
    elementBreakdown,
    insights,
    ...buildViewModel({
      assignedCoursesCount,
      actualCoursesCount,
      missingCoursesCount,
      extraCoursesCount,
      assignmentCoverageRate,
      closureCompletionRate: snapshot.closureCompletionRate,
      submissionRate: toPercent(snapshot.submittedElementsCount, snapshot.requiredElementsCount),
      overdueElementsRate: snapshot.overdueElementsRate,
      stalePendingElementsRate: snapshot.stalePendingElementsRate,
      returnRate: snapshot.returnRate,
      rejectRate: snapshot.rejectRate,
      performanceLevel: snapshot.performanceLevel,
      finalScore: snapshot.finalScore,
    }),
  };
}

// ======================================================================
// مقارنة الأداء عبر الفترات (Trend)
// ======================================================================

async function getPerformanceTrend(userId, periodType, periodsCount = 6, context = {}) {
  const { activeRole, userId: requesterId, supervisedProjectIds = [] } = context;

  // فلتر الصلاحيات
  if (activeRole === 'EMPLOYEE' && userId !== requesterId) {
    const err = new Error('غير مصرح لك بعرض بيانات موظف آخر');
    err.statusCode = 403;
    throw err;
  }
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { operationalProjectId: true },
    });
    if (!target || !supervisedProjectIds.includes(target.operationalProjectId)) {
      const err = new Error('هذا الموظف ليس ضمن مشاريعك');
      err.statusCode = 403;
      throw err;
    }
  }

  const safeCount = Math.min(12, Math.max(2, Number(periodsCount) || 6));

  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: { userId, ...(periodType ? { periodType } : {}) },
    orderBy: { periodStart: 'desc' },
    take: safeCount,
    select: {
      id: true,
      periodType: true,
      periodLabel: true,
      periodStart: true,
      periodEnd: true,
      finalScore: true,
      productivityScore: true,
      qualityScore: true,
      speedScore: true,
      disciplineScore: true,
      performanceLevel: true,
      closureCompletionRate: true,
      firstPassApprovalRate: true,
      returnRate: true,
      overdueElementsRate: true,
    },
  });

  const sorted = snapshots.reverse();
  const trend = sorted.map((snap, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    return {
      ...snap,
      performanceLevelLabel: levelLabel(snap.performanceLevel),
      delta: prev
        ? {
            finalScore: Number((snap.finalScore - prev.finalScore).toFixed(2)),
            productivityScore: Number((snap.productivityScore - prev.productivityScore).toFixed(2)),
            qualityScore: Number((snap.qualityScore - prev.qualityScore).toFixed(2)),
            speedScore: Number((snap.speedScore - prev.speedScore).toFixed(2)),
            disciplineScore: Number((snap.disciplineScore - prev.disciplineScore).toFixed(2)),
          }
        : null,
    };
  });

  const currentPeriod = trend[trend.length - 1] || null;
  const previousPeriod = trend.length >= 2 ? trend[trend.length - 2] : null;

  return {
    userId,
    periodType: periodType || 'ALL',
    periodsCount: trend.length,
    trend,
    summary: {
      bestScore: trend.length ? Math.max(...trend.map((t) => t.finalScore)) : null,
      worstScore: trend.length ? Math.min(...trend.map((t) => t.finalScore)) : null,
      avgScore: trend.length ? toAverage(trend.map((t) => t.finalScore)) : null,
      direction:
        currentPeriod && previousPeriod
          ? currentPeriod.finalScore > previousPeriod.finalScore
            ? 'improving'
            : currentPeriod.finalScore < previousPeriod.finalScore
            ? 'declining'
            : 'stable'
          : 'insufficient_data',
    },
  };
}

// ======================================================================
// ملخص أداء المشروع (للمشرف والمدير)
// ======================================================================

async function getProjectKpiSummary(operationalProjectId, periodType, periodLabel) {
  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: {
      periodType,
      periodLabel,
      user: { isActive: true, operationalProjectId },
    },
    include: { user: { select: { firstName: true, lastName: true } } },
    orderBy: { finalScore: 'desc' },
  });

  if (!snapshots.length) {
    return { projectId: operationalProjectId, periodType, periodLabel, employeesCount: 0, summary: null, snapshots: [] };
  }

  const scores = snapshots.map((s) => s.finalScore);
  const levels = { OUTSTANDING: 0, VERY_GOOD: 0, GOOD: 0, NEEDS_IMPROVEMENT: 0, WEAK: 0 };
  for (const s of snapshots) levels[s.performanceLevel] = (levels[s.performanceLevel] || 0) + 1;

  return {
    projectId: operationalProjectId,
    periodType,
    periodLabel,
    employeesCount: snapshots.length,
    summary: {
      avgScore: toAverage(scores),
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      levelDistribution: levels,
      topPerformer: snapshots[0]
        ? { userId: snapshots[0].userId, name: `${snapshots[0].user.firstName} ${snapshots[0].user.lastName}`, score: snapshots[0].finalScore }
        : null,
      bottomPerformer: snapshots[snapshots.length - 1]
        ? { userId: snapshots[snapshots.length - 1].userId, name: `${snapshots[snapshots.length - 1].user.firstName} ${snapshots[snapshots.length - 1].user.lastName}`, score: snapshots[snapshots.length - 1].finalScore }
        : null,
    },
    snapshots: snapshots.map((s) => ({
      userId: s.userId,
      name: `${s.user.firstName} ${s.user.lastName}`,
      finalScore: s.finalScore,
      performanceLevel: levelLabel(s.performanceLevel),
      productivityScore: s.productivityScore,
      qualityScore: s.qualityScore,
      speedScore: s.speedScore,
      disciplineScore: s.disciplineScore,
    })),
  };
}

// ======================================================================
// ملاحظات المدير
// ======================================================================

async function addManagerNote(snapshotId, userId, managerId, note) {
  if (!note?.trim()) {
    const err = new Error('الملاحظة مطلوبة');
    err.statusCode = 400;
    throw err;
  }

  const snapshot = await prisma.employeeKpiSnapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) {
    const err = new Error('سجل KPI غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const created = await prisma.employeeKpiNote.create({
    data: { snapshotId, userId, managerId, note: note.trim() },
    include: { manager: true },
  });

  await logAudit(managerId, 'MANAGER', 'KPI_NOTE_ADDED', { snapshotId, userId });
  return created;
}

// ======================================================================
// سجل إسناد الدورات
// ======================================================================

async function getAssignmentRegister(periodType, year, value) {
  const { label, start, end } = getPeriodRange(periodType, year, value);

  const employees = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' } },
    include: { operationalProject: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const userIds = employees.map((e) => e.id);
  const [registers, courses] = await Promise.all([
    prisma.courseAssignmentRegister.findMany({
      where: { periodType, periodLabel: label, userId: { in: userIds } },
    }),
    prisma.course.findMany({
      where: {
        primaryEmployeeId: { in: userIds },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true, primaryEmployeeId: true },
    }),
  ]);

  const registerMap = new Map(registers.map((r) => [r.userId, r]));
  const courseCountMap = new Map();
  for (const course of courses) {
    courseCountMap.set(course.primaryEmployeeId, (courseCountMap.get(course.primaryEmployeeId) || 0) + 1);
  }

  const rows = employees.map((employee) => {
    const register = registerMap.get(employee.id);
    const actualCoursesCount = courseCountMap.get(employee.id) || 0;
    const assignedCoursesCount = register?.assignedCoursesCount ?? 0;
    const missingCoursesCount = Math.max(assignedCoursesCount - actualCoursesCount, 0);
    const extraCoursesCount = Math.max(actualCoursesCount - assignedCoursesCount, 0);
    const assignmentCoverageRate = toPercent(actualCoursesCount, assignedCoursesCount);

    return {
      userId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      projectName: employee.operationalProject?.name || '-',
      periodType,
      periodLabel: label,
      periodStart: start,
      periodEnd: end,
      assignedCoursesCount,
      actualCoursesCount,
      notes: register?.notes || '',
      updatedAt: register?.updatedAt || null,
      missingCoursesCount,
      extraCoursesCount,
      courseRegistrationCoverageRate: assignmentCoverageRate,
      isSubjectToEvaluation: !(assignedCoursesCount === 0 && actualCoursesCount === 0),
    };
  });

  return { periodType, periodLabel: label, periodStart: start, periodEnd: end, rows };
}

async function upsertAssignmentRegister(managerId, userId, periodType, year, value, assignedCoursesCount, notes) {
  if (assignedCoursesCount < 0) {
    const err = new Error('عدد الدورات المسندة غير صحيح');
    err.statusCode = 400;
    throw err;
  }

  const employee = await prisma.user.findFirst({ where: { id: userId, isActive: true } });
  if (!employee) {
    const err = new Error('المستخدم غير موجود أو تم تعطيله');
    err.statusCode = 404;
    throw err;
  }

  const { label, start, end } = getPeriodRange(periodType, year, value);

  const saved = await prisma.courseAssignmentRegister.upsert({
    where: { userId_periodType_periodLabel: { userId, periodType, periodLabel: label } },
    update: { assignedCoursesCount, notes: notes?.trim() || null, periodStart: start, periodEnd: end },
    create: { userId, periodType, periodLabel: label, periodStart: start, periodEnd: end, assignedCoursesCount, notes: notes?.trim() || null },
  });

  await logAudit(managerId, 'MANAGER', 'ASSIGNMENT_REGISTER_UPDATED', {
    userId,
    periodType,
    periodLabel: label,
    assignedCoursesCount,
  });

  return saved;
}

// ======================================================================
// لوحة ترتيب المشاريع — من البيانات الحالية
// ======================================================================

async function getProjectLeaderboard(periodLabel) {
  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: { periodType: 'MONTHLY', periodLabel, finalScore: { gt: 0 } },
    include: { user: { include: { operationalProject: true } } },
  });

  if (!snapshots.length) return [];

  // تجميع حسب المشروع
  const byProject = {};
  for (const s of snapshots) {
    const proj = s.user?.operationalProject;
    if (!proj) continue;
    const key = proj.id;
    if (!byProject[key]) {
      byProject[key] = {
        projectId:   proj.id,
        projectName: proj.name,
        scores:      [],
        levels:      { OUTSTANDING:0, VERY_GOOD:0, GOOD:0, NEEDS_IMPROVEMENT:0, WEAK:0 },
        topEmployee: null,
      };
    }
    byProject[key].scores.push(Number(s.finalScore));
    byProject[key].levels[s.performanceLevel] = (byProject[key].levels[s.performanceLevel] || 0) + 1;

    // أفضل موظف في المشروع
    if (!byProject[key].topEmployee || s.finalScore > byProject[key].topEmployee.score) {
      byProject[key].topEmployee = {
        name:  `${s.user.firstName} ${s.user.lastName}`,
        score: Number(s.finalScore),
        level: s.performanceLevel,
      };
    }
  }

  return Object.values(byProject)
    .map(p => ({
      projectId:        p.projectId,
      projectName:      p.projectName,
      employeesCount:   p.scores.length,
      avgScore:         toAverage(p.scores),
      maxScore:         Math.max(...p.scores),
      minScore:         Math.min(...p.scores),
      levelDistribution: p.levels,
      topEmployee:      p.topEmployee,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
}

// ======================================================================
// الاحتساب السنوي — يجمع من كل الدورات خلال السنة كاملة
// ======================================================================

async function calculateYearlyAndStore(year, managerId) {
  const start = new Date(year, 0,  1,  0,  0,  0, 0);
  const end   = new Date(year, 11, 31, 23, 59, 59, 999);
  const label = String(year);

  // نعيد استخدام نفس منطق الشهري لكن بنطاق السنة كاملة
  return calculateAndStore('YEARLY', year, null, managerId, start, end, label);
}

module.exports = {
  calculateAndStore,
  calculateYearlyAndStore,
  getSnapshots,
  getEmployeeSnapshotDetails,
  getPerformanceTrend,
  getProjectKpiSummary,
  getProjectLeaderboard,
  addManagerNote,
  getAssignmentRegister,
  upsertAssignmentRegister,
};
