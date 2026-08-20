import { describe, it, expect, vi, beforeEach } from 'vitest';
// نستعمل require (لا import الافتراضي) لأن الخدمة تستعمل require؛ وتحت vite-node
// لا يكون كائن import الافتراضي === كائن require، فلا يرى التجسّس (vi.spyOn) المستودع.
const svc = require('./kpi.service');
const repo = require('./kpi.repo');

// نعزل الخدمة عن قاعدة البيانات بالتجسّس على دوال المستودع.
// (الخدمة والاختبار يتشاركان نفس كائن module.exports، فالتجسّس يراه الطرفان.)
const REPO_METHODS = [
  'findActiveSettings', 'findActiveEmployees', 'findAllProjectSupervisors',
  'findAssignmentRegisters', 'findCoursesWithElements', 'groupOptionalReports',
  'upsertSnapshot', 'findSnapshots', 'findAssignmentsForUsers', 'findCoursesMinimal',
  'findUserProject', 'findSnapshotForDetails', 'findAssignmentUnique', 'countCoursesInRange',
  'findEmployeeCoursesWithElements', 'findTrendSnapshots', 'findProjectSnapshots',
  'findSnapshotById', 'createNote', 'findCoursesForRegister', 'findActiveUser',
  'upsertAssignment', 'findLeaderboardSnapshots',
];

beforeEach(() => {
  vi.restoreAllMocks();
  for (const m of REPO_METHODS) vi.spyOn(repo, m).mockResolvedValue(undefined);
});

// ======================================================================
// قفل الرياضيات: مدخلات ثابتة → مخرجات متوقعة (verbatim من المحرّك)
// ======================================================================

describe('kpi.service pure helpers (lock the math)', () => {
  describe('clampScore', () => {
    it('clamps below 0 to 0', () => {
      expect(svc.clampScore(-3)).toBe(0);
    });
    it('clamps above 100 to 100', () => {
      expect(svc.clampScore(150)).toBe(100);
    });
    it('rounds to 2 decimals', () => {
      expect(svc.clampScore(87.6789)).toBe(87.68);
    });
  });

  describe('toPercent', () => {
    it('returns 0 when denominator is falsy', () => {
      expect(svc.toPercent(5, 0)).toBe(0);
    });
    it('computes a 2-decimal percentage', () => {
      expect(svc.toPercent(1, 3)).toBe(33.33);
      expect(svc.toPercent(7, 8)).toBe(87.5);
    });
  });

  describe('getPerformanceLevel', () => {
    it('maps score bands to levels (boundaries inclusive)', () => {
      expect(svc.getPerformanceLevel(90)).toBe('OUTSTANDING');
      expect(svc.getPerformanceLevel(80)).toBe('VERY_GOOD');
      expect(svc.getPerformanceLevel(70)).toBe('GOOD');
      expect(svc.getPerformanceLevel(60)).toBe('NEEDS_IMPROVEMENT');
      expect(svc.getPerformanceLevel(59.99)).toBe('WEAK');
    });
  });

  describe('getPeriodRange', () => {
    it('builds a monthly label/range', () => {
      const r = svc.getPeriodRange('MONTHLY', 2026, 5);
      expect(r.label).toBe('2026-05');
      expect(r.start.getTime()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).getTime());
      expect(r.end.getTime()).toBe(new Date(2026, 5, 0, 23, 59, 59, 999).getTime());
    });
    it('builds a quarterly label/range', () => {
      const r = svc.getPeriodRange('QUARTERLY', 2026, 2);
      expect(r.label).toBe('2026-Q2');
      expect(r.start.getTime()).toBe(new Date(2026, 3, 1, 0, 0, 0, 0).getTime());
      expect(r.end.getTime()).toBe(new Date(2026, 6, 0, 23, 59, 59, 999).getTime());
    });
    it('throws 400 on an invalid month', () => {
      expect(() => svc.getPeriodRange('MONTHLY', 2026, 13)).toThrowError();
      try { svc.getPeriodRange('MONTHLY', 2026, 0); } catch (e) { expect(e.statusCode).toBe(400); }
    });
  });

  describe('calculateWeightedScores', () => {
    it('returns all-zero scores when not subject to evaluation', () => {
      expect(svc.calculateWeightedScores({ isSubjectToEvaluation: false })).toEqual({
        productivityScore: 0, speedScore: 0, qualityScore: 0, disciplineScore: 0, finalScore: 0,
      });
    });

    it('computes a perfect 100 from perfect inputs with default weights', () => {
      const perfect = {
        isSubjectToEvaluation: true,
        assignmentCoverageRate: 100,
        missingCoursesRate: 0,
        submissionRate: 100,
        completionRate: 100,
        firstPassSubmissionRate: 100,
        returnRate: 0,
        rejectRate: 0,
        operationalErrorRate: 0,
        avgElementSubmissionHours: 0,
        avgResubmissionHours: 0,
        overdueElementsRate: 0,
        stalePendingElementsRate: 0,
      };
      expect(svc.calculateWeightedScores(perfect)).toEqual({
        productivityScore: 100,
        speedScore: 100,
        qualityScore: 100,
        disciplineScore: 100,
        finalScore: 100,
      });
    });
  });

  describe('calcElementTimeScore', () => {
    it('scores 100 with no deadline ref but a submission', () => {
      const tracking = { executionAt: new Date('2026-01-01'), element: {} };
      expect(svc.calcElementTimeScore(tracking, {})).toBe(100);
    });
    it('scores 100 when submitted before the ideal deadline', () => {
      const course = { startDate: new Date('2026-01-01T00:00:00Z') };
      const tracking = {
        executionAt: new Date('2026-01-01T05:00:00Z'),
        element: { deadlineRefPoint: 'START', deadlineIdealHours: 24, deadlineMaxHours: 48 },
      };
      expect(svc.calcElementTimeScore(tracking, course)).toBe(100);
    });
    it('scores 70 between ideal and max, 20 after max', () => {
      const course = { startDate: new Date('2026-01-01T00:00:00Z') };
      const el = { deadlineRefPoint: 'START', deadlineIdealHours: 24, deadlineMaxHours: 48 };
      expect(svc.calcElementTimeScore({ executionAt: new Date('2026-01-02T12:00:00Z'), element: el }, course)).toBe(70);
      expect(svc.calcElementTimeScore({ executionAt: new Date('2026-01-04T00:00:00Z'), element: el }, course)).toBe(20);
    });
  });

  describe('resolveWeights (H5: settings drive the final blend)', () => {
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

    it('falls back to defaults when no settings row exists', () => {
      expect(svc.resolveWeights(null)).toBe(svc.resolveWeights(null)); // same DEFAULT reference
      const w = svc.resolveWeights(null);
      expect(w.finalBlend).toEqual({ productivity: 0.25, timing: 0.20, quality: 0.20, critical: 0.20, speed: 0.10, discipline: 0.05 });
    });

    it('normalizes intra-category sub-weights to sum to 1 (fixes the deflation bug)', () => {
      const s = {
        closureCompletionWeight: 15, overdueClosuresWeight: 15, avgCourseClosureWeight: 10,
        firstPassApprovalWeight: 15, returnRateWeight: 10, rejectRateWeight: 5, errorRateWeight: 5,
        avgElementSubmissionWeight: 5, avgResubmissionWeight: 5,
        overdueCoursesWeight: 5, overdueElementsWeight: 5, staleElementsWeight: 5,
      };
      const w = svc.resolveWeights(s);
      expect(sum(w.productivity)).toBeCloseTo(1, 9);
      expect(sum(w.quality)).toBeCloseTo(1, 9);
      expect(sum(w.speed)).toBeCloseTo(1, 9);
      expect(sum(w.discipline)).toBeCloseTo(1, 9);
      expect(sum(w.finalBlend)).toBeCloseTo(1, 9);
    });

    it('shifts the final blend toward a category whose weights are raised', () => {
      const base = {
        closureCompletionWeight: 10, overdueClosuresWeight: 10, avgCourseClosureWeight: 10,
        firstPassApprovalWeight: 10, returnRateWeight: 10, rejectRateWeight: 10, errorRateWeight: 10,
        avgElementSubmissionWeight: 10, avgResubmissionWeight: 10,
        overdueCoursesWeight: 10, overdueElementsWeight: 10, staleElementsWeight: 10,
      };
      const boosted = { ...base, firstPassApprovalWeight: 100 }; // يرفع فئة الجودة
      const wBase = svc.resolveWeights(base);
      const wBoost = svc.resolveWeights(boosted);
      expect(wBoost.finalBlend.quality).toBeGreaterThan(wBase.finalBlend.quality);
      // التوقيت والعناصر الحرجة يبقيان ثابتين
      expect(wBoost.finalBlend.timing).toBe(0.20);
      expect(wBoost.finalBlend.critical).toBe(0.20);
    });
  });

  describe('addDeadlineHours (M1: working-days deadlines)', () => {
    const HOUR = 1000 * 60 * 60;

    // أول خميس من يونيو 2026 بالتوقيت المحلي (مستقل عن المنطقة الزمنية للمشغّل)
    function firstThursday() {
      let d = new Date(2026, 5, 1, 0, 0, 0, 0);
      while (d.getDay() !== 4) d = new Date(d.getTime() + 24 * HOUR);
      return d;
    }

    it('calendar mode adds raw hours unchanged', () => {
      const ref = firstThursday();
      expect(svc.addDeadlineHours(ref, 48, false).getTime()).toBe(ref.getTime() + 48 * HOUR);
    });

    it('working-days mode skips Fri/Sat (Thu + 48 working hours lands Monday)', () => {
      const ref = firstThursday(); // الخميس 00:00
      const cal = svc.addDeadlineHours(ref, 48, false);
      const work = svc.addDeadlineHours(ref, 48, true);
      // الخميس يستهلك 24، تُتخطّى الجمعة والسبت، الأحد يستهلك 24 → ينتهي الاثنين 00:00
      expect(work.getDay()).toBe(1);              // الاثنين
      expect(work.getTime()).toBeGreaterThan(cal.getTime()); // العطلة دفعت الموعد للأمام
    });

    it('working-days mode equals calendar when no weekend is crossed', () => {
      // الأحد 00:00 + 24 ساعة عمل = الاثنين 00:00 (لا عطلة في المنتصف)
      let ref = new Date(2026, 5, 1, 0, 0, 0, 0);
      while (ref.getDay() !== 0) ref = new Date(ref.getTime() + 24 * HOUR); // أحد
      expect(svc.addDeadlineHours(ref, 24, true).getTime()).toBe(ref.getTime() + 24 * HOUR);
    });
  });
});

// ======================================================================
// حالة صلاحيات/حارس
// ======================================================================

describe('kpi.service guards', () => {
  it('getEmployeeSnapshotDetails forbids an EMPLOYEE viewing another user (403) and never queries', async () => {
    await expect(
      svc.getEmployeeSnapshotDetails('other-user', 'MONTHLY', '2026-05', {
        activeRole: 'EMPLOYEE',
        userId: 'me',
        supervisedProjectIds: [],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findSnapshotForDetails).not.toHaveBeenCalled();
  });

  it('getEmployeeSnapshotDetails forbids a PROJECT_SUPERVISOR outside their projects (403)', async () => {
    repo.findUserProject.mockResolvedValue({ operationalProjectId: 'proj-X' });
    await expect(
      svc.getEmployeeSnapshotDetails('emp-1', 'MONTHLY', '2026-05', {
        activeRole: 'PROJECT_SUPERVISOR',
        userId: 'sup-1',
        supervisedProjectIds: ['proj-A', 'proj-B'],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.findSnapshotForDetails).not.toHaveBeenCalled();
  });
});
