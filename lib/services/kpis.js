// =============================================================
// خدمة مؤشرات الأداء الكاملة
// -------------------------------------------------------------
// نقل حرفي لجميع المنطق الأصلي (٩٦١ سطر) بدون اختزال.
// الاختلاف الوحيد: فقط المدير يستطيع إدارة وتقييم الموظفين.
// =============================================================

const prisma = require('../db/prisma');
const { logAudit } = require('./audit');

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

  // YEARLY
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
// حساب النقاط المرجّحة
// ======================================================================

function calculateWeightedScores(metrics) {
  if (!metrics.isSubjectToEvaluation) {
    return {
      productivityScore: 0,
      speedScore: 0,
      qualityScore: 0,
      disciplineScore: 0,
      finalScore: 0,
    };
  }

  const coverageScore = Math.max(
    0,
    metrics.assignmentCoverageRate - metrics.missingCoursesRate * 0.5,
  );

  const productivityScore =
    coverageScore * 0.45 +
    metrics.submissionRate * 0.2 +
    metrics.completionRate * 0.35;

  const qualityScore =
    metrics.firstPassSubmissionRate * 0.45 +
    (100 - metrics.returnRate) * 0.2 +
    (100 - metrics.rejectRate) * 0.15 +
    (100 - metrics.operationalErrorRate) * 0.2;

  const elementSubmissionScore = Math.max(0, 100 - metrics.avgElementSubmissionHours * 2);
  const resubmissionScore = Math.max(0, 100 - metrics.avgResubmissionHours * 2.5);

  const speedScore = elementSubmissionScore * 0.7 + resubmissionScore * 0.3;

  const disciplineScore =
    (100 - metrics.missingCoursesRate) * 0.35 +
    (100 - metrics.overdueElementsRate) * 0.35 +
    (100 - metrics.stalePendingElementsRate) * 0.3;

  const finalScore =
    productivityScore * 0.35 +
    qualityScore * 0.25 +
    speedScore * 0.2 +
    disciplineScore * 0.2;

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
// حساب وحفظ لقطات الأداء
// ======================================================================

async function calculateAndStore(periodType, year, value, managerId) {
  const { label, start, end } = getPeriodRange(periodType, year, value);

  const employees = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' } },
    include: { operationalProject: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  const snapshots = [];

  for (const employee of employees) {
    const assignment = await prisma.courseAssignmentRegister.findUnique({
      where: {
        userId_periodType_periodLabel: {
          userId: employee.id,
          periodType,
          periodLabel: label,
        },
      },
    });

    const courses = await prisma.course.findMany({
      where: { primaryEmployeeId: employee.id },
      include: { closureElements: { include: { element: true } } },
    });

    const relevantCourses = courses.filter((course) => {
      const courseStart = new Date(course.startDate);
      const courseEnd = new Date(course.endDate);
      return courseStart <= end && courseEnd >= start;
    });

    const relevantElements = relevantCourses.flatMap((course) =>
      course.closureElements.filter((el) => el.status !== 'NOT_APPLICABLE'),
    );

    const submittedElements = relevantElements.filter((el) => !!el.executionAt);
    const approvedElements = relevantElements.filter((el) => el.status === 'APPROVED');
    const returnedElements = relevantElements.filter((el) => el.status === 'RETURNED');
    const rejectedElements = relevantElements.filter((el) => el.status === 'REJECTED');
    const pendingApprovalElements = relevantElements.filter((el) => el.status === 'PENDING_APPROVAL');
    const completedElements = [...approvedElements, ...pendingApprovalElements];

    const now = new Date();

    const overdueElements = relevantElements.filter((el) => {
      if (el.status !== 'NOT_STARTED' && el.status !== 'RETURNED') return false;
      const course = relevantCourses.find((c) => c.id === el.courseId);
      if (!course) return false;
      return new Date(course.endDate) < now;
    });

    const stalePendingElements = relevantElements.filter((el) => {
      if (el.status !== 'NOT_STARTED' && el.status !== 'RETURNED') return false;
      const baseDate =
        el.status === 'RETURNED' && el.decisionAt
          ? new Date(el.decisionAt)
          : relevantCourses.find((c) => c.id === el.courseId)?.createdAt;
      if (!baseDate) return false;
      const diffHours = (now.getTime() - new Date(baseDate).getTime()) / (1000 * 60 * 60);
      return diffHours > 72;
    });

    const submittedWithoutReturnOrReject = submittedElements.filter(
      (el) => el.status !== 'RETURNED' && el.status !== 'REJECTED',
    );

    const elementSubmissionHours = submittedElements.map((el) => {
      const course = relevantCourses.find((c) => c.id === el.courseId);
      if (!course || !el.executionAt) return 0;
      const diff = new Date(el.executionAt).getTime() - new Date(course.createdAt).getTime();
      return Math.max(0, diff / (1000 * 60 * 60));
    });

    const resubmissionHours = submittedElements
      .filter((el) => el.decisionAt && el.executionAt && el.status !== 'APPROVED')
      .map((el) => {
        const diff = new Date(el.executionAt).getTime() - new Date(el.decisionAt).getTime();
        return Math.max(0, diff / (1000 * 60 * 60));
      });

    const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
    const actualCoursesCount = relevantCourses.length;
    const missingCoursesCount = Math.max(assignedCoursesCount - actualCoursesCount, 0);
    const extraCoursesCount = Math.max(actualCoursesCount - assignedCoursesCount, 0);
    const assignmentCoverageRate = toPercent(actualCoursesCount, assignedCoursesCount);
    const missingCoursesRate = toPercent(missingCoursesCount, assignedCoursesCount);
    const isSubjectToEvaluation = !(assignedCoursesCount === 0 && actualCoursesCount === 0);

    const metrics = {
      isSubjectToEvaluation,
      requiredElementsCount: relevantElements.length,
      completedElementsCount: completedElements.length,
      closureCompletionRate: toPercent(completedElements.length, relevantElements.length),

      submittedElementsCount: submittedElements.length,
      approvedElementsCount: approvedElements.length,
      returnedElementsCount: returnedElements.length,
      rejectedElementsCount: rejectedElements.length,

      submissionRate: toPercent(submittedElements.length, relevantElements.length),
      firstPassSubmissionRate: toPercent(submittedWithoutReturnOrReject.length, submittedElements.length),
      returnRate: toPercent(returnedElements.length, submittedElements.length),
      rejectRate: toPercent(rejectedElements.length, submittedElements.length),
      operationalErrorRate: toPercent(
        returnedElements.length + rejectedElements.length,
        submittedElements.length,
      ),

      avgElementSubmissionHours: toAverage(elementSubmissionHours),
      avgResubmissionHours: toAverage(resubmissionHours),

      overdueElementsCount: overdueElements.length,
      overdueElementsRate: toPercent(overdueElements.length, relevantElements.length),

      stalePendingElementsCount: stalePendingElements.length,
      stalePendingElementsRate: toPercent(stalePendingElements.length, relevantElements.length),

      assignmentCoverageRate,
      missingCoursesRate,
    };

    const scores = calculateWeightedScores({
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
    });

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
      avgCourseClosureDelayDays: 0,
      overdueCoursesCount: missingCoursesCount,
      overdueCoursesRate: metrics.missingCoursesRate,
      overdueElementsCount: metrics.overdueElementsCount,
      overdueElementsRate: metrics.overdueElementsRate,
      stalePendingElementsCount: metrics.stalePendingElementsCount,
      stalePendingElementsRate: metrics.stalePendingElementsRate,
      productivityScore: scores.productivityScore,
      speedScore: scores.speedScore,
      qualityScore: scores.qualityScore,
      disciplineScore: scores.disciplineScore,
      finalScore: scores.finalScore,
      performanceLevel,
      settingsId: null,
    };

    const snapshot = await prisma.employeeKpiSnapshot.upsert({
      where: {
        userId_periodType_periodLabel: {
          userId: employee.id,
          periodType,
          periodLabel: label,
        },
      },
      update: snapshotData,
      create: {
        userId: employee.id,
        periodType,
        periodLabel: label,
        ...snapshotData,
      },
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
    results: snapshots.sort((a, b) => {
      if (a.isSubjectToEvaluation !== b.isSubjectToEvaluation) {
        return a.isSubjectToEvaluation ? -1 : 1;
      }
      return (b.finalScoreDisplay ?? -1) - (a.finalScoreDisplay ?? -1);
    }),
  };
}

// ======================================================================
// جلب اللقطات
// ======================================================================

async function getSnapshots(periodType, periodLabel) {
  const snapshots = await prisma.employeeKpiSnapshot.findMany({
    where: {
      ...(periodType ? { periodType } : {}),
      ...(periodLabel ? { periodLabel } : {}),
    },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: [{ finalScore: 'desc' }, { createdAt: 'desc' }],
  });

  const enriched = await Promise.all(
    snapshots.map(async (snapshot) => {
      const assignment = await prisma.courseAssignmentRegister.findUnique({
        where: {
          userId_periodType_periodLabel: {
            userId: snapshot.userId,
            periodType: snapshot.periodType,
            periodLabel: snapshot.periodLabel,
          },
        },
      });

      const actualCoursesCount = await prisma.course.count({
        where: {
          primaryEmployeeId: snapshot.userId,
          startDate: { lte: snapshot.periodEnd },
          endDate: { gte: snapshot.periodStart },
        },
      });

      const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
      const missingCoursesCount = Math.max(assignedCoursesCount - actualCoursesCount, 0);
      const extraCoursesCount = Math.max(actualCoursesCount - assignedCoursesCount, 0);
      const assignmentCoverageRate = toPercent(actualCoursesCount, assignedCoursesCount);

      return {
        ...snapshot,
        assignedCoursesCount,
        actualCoursesCount,
        missingCoursesCount,
        extraCoursesCount,
        courseRegistrationCoverageRate: assignmentCoverageRate,
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
    }),
  );

  return enriched.sort((a, b) => {
    if (a.isSubjectToEvaluation !== b.isSubjectToEvaluation) {
      return a.isSubjectToEvaluation ? -1 : 1;
    }
    return (b.finalScoreDisplay ?? -1) - (a.finalScoreDisplay ?? -1);
  });
}

// ======================================================================
// تفاصيل لقطة موظف
// ======================================================================

async function getEmployeeSnapshotDetails(userId, periodType, periodLabel) {
  const snapshot = await prisma.employeeKpiSnapshot.findUnique({
    where: {
      userId_periodType_periodLabel: { userId, periodType, periodLabel },
    },
    include: {
      user: { include: { operationalProject: true } },
      settings: true,
      notes: { include: { manager: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!snapshot) {
    const err = new Error('لا توجد بيانات KPI لهذه الفترة');
    err.statusCode = 404;
    throw err;
  }

  const assignment = await prisma.courseAssignmentRegister.findUnique({
    where: {
      userId_periodType_periodLabel: { userId, periodType, periodLabel },
    },
  });

  const actualCoursesCount = await prisma.course.count({
    where: {
      primaryEmployeeId: userId,
      startDate: { lte: snapshot.periodEnd },
      endDate: { gte: snapshot.periodStart },
    },
  });

  const assignedCoursesCount = assignment?.assignedCoursesCount ?? 0;
  const missingCoursesCount = Math.max(assignedCoursesCount - actualCoursesCount, 0);
  const extraCoursesCount = Math.max(actualCoursesCount - assignedCoursesCount, 0);
  const assignmentCoverageRate = toPercent(actualCoursesCount, assignedCoursesCount);

  return {
    ...snapshot,
    assignedCoursesCount,
    actualCoursesCount,
    missingCoursesCount,
    extraCoursesCount,
    courseRegistrationCoverageRate: assignmentCoverageRate,
    assignmentNotes: assignment?.notes || null,
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

  const rows = await Promise.all(
    employees.map(async (employee) => {
      const register = await prisma.courseAssignmentRegister.findUnique({
        where: {
          userId_periodType_periodLabel: {
            userId: employee.id,
            periodType,
            periodLabel: label,
          },
        },
      });

      const actualCoursesCount = await prisma.course.count({
        where: {
          primaryEmployeeId: employee.id,
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

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
    }),
  );

  return {
    periodType,
    periodLabel: label,
    periodStart: start,
    periodEnd: end,
    rows,
  };
}

async function upsertAssignmentRegister(managerId, userId, periodType, year, value, assignedCoursesCount, notes) {
  if (assignedCoursesCount < 0) {
    const err = new Error('عدد الدورات المسندة غير صحيح');
    err.statusCode = 400;
    throw err;
  }

  const employee = await prisma.user.findUnique({ where: { id: userId } });
  if (!employee) {
    const err = new Error('المستخدم غير موجود');
    err.statusCode = 404;
    throw err;
  }

  const { label, start, end } = getPeriodRange(periodType, year, value);

  const saved = await prisma.courseAssignmentRegister.upsert({
    where: {
      userId_periodType_periodLabel: { userId, periodType, periodLabel: label },
    },
    update: {
      assignedCoursesCount,
      notes: notes?.trim() || null,
      periodStart: start,
      periodEnd: end,
    },
    create: {
      userId,
      periodType,
      periodLabel: label,
      periodStart: start,
      periodEnd: end,
      assignedCoursesCount,
      notes: notes?.trim() || null,
    },
  });

  await logAudit(managerId, 'MANAGER', 'ASSIGNMENT_REGISTER_UPDATED', {
    userId,
    periodType,
    periodLabel: label,
    assignedCoursesCount,
  });

  return saved;
}

module.exports = {
  // الحساب والتخزين
  calculateAndStore,
  // اللقطات
  getSnapshots,
  getEmployeeSnapshotDetails,
  // ملاحظات
  addManagerNote,
  // سجل الإسناد
  getAssignmentRegister,
  upsertAssignmentRegister,
};
