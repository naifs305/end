// ======================================================================
// نموذج مؤشرات الأداء — الإصدار الثاني (أربعة محاور، والتأخير يُحاسَب مرة واحدة)
// ----------------------------------------------------------------------
//   الالتزام بالمواعيد   ٦٠٪  درجة لكل عنصر مستحق: في المثالي ١٠٠، حتى الأقصى ٨٠،
//                              ثم تنقص ١٠ عن كل يوم تأخير. العنصر الحرج وزنه مضاعف.
//   جودة التنفيذ        ١٠٪  المقبول من أول تقديم ١٠٠، أُعيد مرة ٦٠، أكثر ٣٠، رُفض ٠.
//   إقفال الدورات       ٢٠٪  كل دورة تُقاس بأبعد موعد أقصى بين عناصرها هي:
//                              أُقفلت قبله ١٠٠، وتنقص ١٠ عن كل يوم بعده.
//   التميّز والتعاون     ١٠٪  نجمة التوثيق، ومراجعة شهادات الزملاء، وتقييم صعوبات
//                              الإقفال، والتقارير الاختيارية والميدانية (حتى ١٠٠).
//
// الإنصاف: لا يُحتسب عنصر موقوف أو معفى أو غير منطبق، ولا مدة بلاغ العائق،
// والتمديد يُزيح الموعد، والعنصر الذي فات قبل إدخال الدورة بمبرر مقبول مستثنى
// (كلها من المصدر الواحد للمواعيد). ومحور بلا بيانات لا يُحتسب، ويُوزَّع وزنه
// على المحاور الأخرى بنسبها.
//
// دوال صافية بلا قاعدة بيانات — يمرَّر إليها ما تحتاجه، فتُختبر وحدها.
// ======================================================================
const { computeElementDeadlines, isWorkingDay } = require('../../shared/deadlines');

const MODEL_VERSION = 2;
const WEIGHTS = { punctuality: 0.6, quality: 0.1, closure: 0.2, excellence: 0.1 };

const CRITICAL_KEYS = new Set([
  'opening_report', 'closing_report',
  'supervisor_compensation', 'settlement',
  'medical_insurance', 'certificates',
]);

const DAY = 24 * 60 * 60 * 1000;
const SCORE_ON_IDEAL = 100;
const SCORE_ON_MAX = 80;
const PENALTY_PER_DAY = 10;

// نقاط التميّز والتعاون (يُجمع حتى ١٠٠)
const EXCELLENCE_POINTS = {
  documentationStar: 40, // دورة وُثّقت بنجمة تميّز
  certReview: 25,        // مراجعة شهادات زميل (أكّدها أو أعادها بملاحظات)
  fieldReport: 10,       // تقرير ميداني أو تقرير اختياري
  closureReviewShare: 30, // نسبة الدورات المقفلة التي قُيّمت صعوباتها × ٣٠
};

const round1 = (n) => Math.round(n * 10) / 10;
const clamp = (n) => Math.max(0, Math.min(100, n));

/** أيام التأخير بعد موعد: أيام عمل لعناصر أيام العمل، وإلا أيام تقويمية (يوم ناقص = يوم) */
function lateDays(deadline, at, workingDays) {
  const from = new Date(deadline).getTime();
  const to = new Date(at).getTime();
  if (!(to > from)) return 0;
  if (!workingDays) return Math.ceil((to - from) / DAY);
  let days = 0;
  for (let t = from; t < to; t += DAY) {
    if (isWorkingDay(new Date(t))) days += 1;
  }
  return Math.max(1, days);
}

/** درجة بعد موعد أقصى فائت: ٨٠ ثم تنقص ١٠ عن كل يوم */
const afterMax = (days) => Math.max(0, SCORE_ON_MAX - PENALTY_PER_DAY * days);

/**
 * درجة الالتزام لعنصر واحد. تعيد null إن لم يكن مستحقاً بعد أو كان مستثنى.
 * { score, status: 'ideal'|'withinMax'|'late'|'missing', lateDays, critical }
 */
function elementPunctuality(tracking, course, now) {
  const d = computeElementDeadlines(tracking, course, now);
  if (!d.hasDeadline || d.excludedFromTiming) return null;
  const critical = CRITICAL_KEYS.has(tracking.element?.key);
  const working = !!tracking.element?.isDeadlineWorkingDays;
  if (tracking.executionAt) {
    const at = new Date(tracking.executionAt);
    if (at <= d.idealDeadline) return { score: SCORE_ON_IDEAL, status: 'ideal', lateDays: 0, critical };
    if (at <= d.maxDeadline) return { score: SCORE_ON_MAX, status: 'withinMax', lateDays: 0, critical };
    const days = lateDays(d.maxDeadline, at, working);
    return { score: afterMax(days), status: 'late', lateDays: days, critical };
  }
  if (now <= d.maxDeadline) return null; // لم يحن موعده الأقصى — لا يُحتسب بعد
  const days = lateDays(d.maxDeadline, now, working);
  return { score: afterMax(days), status: 'missing', lateDays: days, critical };
}

/** جودة عنصر مقدَّم: من سجل إعاداته ورفضه */
function elementQuality(tracking, history = {}) {
  if (!tracking.executionAt) return null;
  const rejected = (history.rejected || 0) + (tracking.status === 'REJECTED' && !history.rejected ? 1 : 0);
  const returned = (history.returned || 0) + (tracking.status === 'RETURNED' && !history.returned ? 1 : 0);
  if (rejected > 0) return { score: 0, returned, rejected };
  if (returned >= 2) return { score: 30, returned, rejected };
  if (returned === 1) return { score: 60, returned, rejected };
  return { score: 100, returned: 0, rejected: 0 };
}

/**
 * موعد إقفال الدورة = أبعد موعد أقصى بين عناصرها المنطبقة (مع البلاغات والتمديد).
 * دورة بلا سلفة تُقاس بالشهادات والمستحقات، ودورة بسلفة بتسويتها.
 */
function courseClosureDeadline(course, now) {
  let latest = null;
  let working = false;
  for (const t of course.closureElements || []) {
    if (t.status === 'NOT_APPLICABLE') continue;
    const d = computeElementDeadlines(t, course, now);
    if (!d.hasDeadline) continue;
    if (!latest || d.maxDeadline > latest) { latest = d.maxDeadline; working = !!t.element?.isDeadlineWorkingDays; }
  }
  return latest ? { deadline: latest, working } : null;
}

function courseClosure(course, now) {
  const due = courseClosureDeadline(course, now);
  if (!due) return null;
  const closed = ['CLOSED', 'ARCHIVED'].includes(course.status);
  const closedAt = closed ? new Date(course.closedAt || course.updatedAt) : null;
  if (closed) {
    const days = lateDays(due.deadline, closedAt, due.working);
    return { score: days ? Math.max(0, 100 - PENALTY_PER_DAY * days) : 100, status: days ? 'closedLate' : 'closedOnTime', lateDays: days, deadline: due.deadline };
  }
  if (now <= due.deadline) return null; // لم يحن موعد إقفالها بعد
  const days = lateDays(due.deadline, now, due.working);
  return { score: Math.max(0, 100 - PENALTY_PER_DAY * days), status: 'open', lateDays: days, deadline: due.deadline };
}

const weightedAvg = (items) => {
  const w = items.reduce((s, x) => s + x.weight, 0);
  return w ? items.reduce((s, x) => s + x.score * x.weight, 0) / w : null;
};

/**
 * يحسب درجة منسق في فترة.
 * @param {object} input
 *   elements   عناصر الإقفال المحسوبة عليه (ومع كل منها element و blockers)
 *   courses    كل دوراته وما نفّذ فيه عناصر (لحساب مواعيد العناصر)
 *   ownedCourses الدورات التي يملكها (لمحور الإقفال والتميّز)
 *   history    Map: `${courseId}|${elementKey}` → { returned, rejected }
 *   activity   { certReviews, fieldReports, closureReviews }
 *   lateEntryPenalty  نقاط الإدخال المتأخر المرفوض مبرره (تُخصم من الالتزام)
 *   now        لحظة الاحتساب (نهاية الفترة إن كانت ماضية)
 */
function scoreEmployee({ elements = [], courses = [], ownedCourses = [], history = new Map(), activity = {}, lateEntryPenalty = 0, now = new Date() }) {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const lost = []; // ما خسر فيه نقاطاً — لصفحة «لماذا درجتي هكذا؟»

  // ── ١. الالتزام بالمواعيد ──
  const punct = [];
  let onIdeal = 0;
  for (const t of elements) {
    if (t.status === 'NOT_APPLICABLE') continue;
    const course = courseById.get(t.courseId);
    const p = course && elementPunctuality(t, course, now);
    if (!p) continue;
    punct.push({ score: p.score, weight: p.critical ? 2 : 1 });
    if (p.status === 'ideal') onIdeal += 1;
    if (p.score < 100) {
      lost.push({ axis: 'punctuality', courseId: course.id, courseName: course.name, element: t.element?.name || '', status: p.status, lateDays: p.lateDays, score: p.score, critical: p.critical });
    }
  }
  let punctuality = weightedAvg(punct);
  if (punctuality !== null && lateEntryPenalty > 0) {
    punctuality = Math.max(0, punctuality - lateEntryPenalty);
    lost.push({ axis: 'punctuality', status: 'lateEntry', score: -lateEntryPenalty });
  }

  // ── ٢. جودة التنفيذ ──
  const qual = [];
  for (const t of elements) {
    if (t.status === 'NOT_APPLICABLE') continue;
    const q = elementQuality(t, history.get(`${t.courseId}|${t.element?.key}`));
    if (!q) continue;
    qual.push({ score: q.score, weight: 1 });
    if (q.score < 100) {
      const course = courseById.get(t.courseId);
      lost.push({ axis: 'quality', courseId: t.courseId, courseName: course?.name || '', element: t.element?.name || '', returned: q.returned, rejected: q.rejected, score: q.score });
    }
  }
  const quality = weightedAvg(qual);

  // ── ٣. إقفال الدورات ──
  const clos = [];
  for (const c of ownedCourses) {
    const r = courseClosure(c, now);
    if (!r) continue;
    clos.push({ score: r.score, weight: 1 });
    if (r.score < 100) lost.push({ axis: 'closure', courseId: c.id, courseName: c.name, status: r.status, lateDays: r.lateDays, score: r.score });
  }
  const closure = weightedAvg(clos);

  // ── ٤. التميّز والتعاون ──
  // النجمة في شهر نيلها (يمرَّر من الخدمة)، وإلا من دورات الفترة
  const stars = Number.isFinite(activity.documentationStars)
    ? activity.documentationStars
    : ownedCourses.filter((c) => c.documentation?.starAwarded).length;
  const closedOwned = ownedCourses.filter((c) => ['CLOSED', 'ARCHIVED'].includes(c.status)).length;
  const reviewedShare = closedOwned ? Math.min(1, (activity.closureReviews || 0) / closedOwned) : 0;
  const excellenceParts = {
    documentationStars: stars,
    certReviews: activity.certReviews || 0,
    fieldReports: activity.fieldReports || 0,
    closureReviewShare: Math.round(reviewedShare * 100),
  };
  const excellence = clamp(
    stars * EXCELLENCE_POINTS.documentationStar
    + excellenceParts.certReviews * EXCELLENCE_POINTS.certReview
    + excellenceParts.fieldReports * EXCELLENCE_POINTS.fieldReport
    + reviewedShare * EXCELLENCE_POINTS.closureReviewShare,
  );

  // ── الدرجة النهائية: المحاور ذات البيانات، والتميّز دائماً ──
  const axes = { punctuality, quality, closure };
  const isSubjectToEvaluation = Object.values(axes).some((v) => v !== null);
  let finalScore = null;
  if (isSubjectToEvaluation) {
    const parts = Object.entries(axes).filter(([, v]) => v !== null).map(([k, v]) => ({ score: v, weight: WEIGHTS[k] }));
    parts.push({ score: excellence, weight: WEIGHTS.excellence });
    finalScore = round1(clamp(weightedAvg(parts)));
  }

  const r = (v) => (v === null ? null : round1(clamp(v)));
  return {
    modelVersion: MODEL_VERSION,
    isSubjectToEvaluation,
    finalScore,
    punctuality: r(punctuality),
    quality: r(quality),
    closure: r(closure),
    excellence: round1(excellence),
    counts: {
      dueElements: punct.length,
      onIdeal,
      submitted: qual.length,
      firstPass: qual.filter((x) => x.score === 100).length,
      dueCourses: clos.length,
      closedOnTime: clos.filter((x) => x.score === 100).length,
    },
    excellenceParts,
    smallSample: punct.length + clos.length < 3,
    lost: lost.sort((a, b) => a.score - b.score).slice(0, 40),
  };
}

/** متوسط آخر ثلاثة أشهر خاضعة للتقييم (للترتيب) */
function rollingScore(scores) {
  const valid = (scores || []).filter((s) => Number.isFinite(s) && s >= 0).slice(0, 3);
  return valid.length ? round1(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

module.exports = {
  MODEL_VERSION, WEIGHTS, CRITICAL_KEYS, EXCELLENCE_POINTS,
  lateDays, elementPunctuality, elementQuality, courseClosureDeadline, courseClosure, scoreEmployee, rollingScore,
};
