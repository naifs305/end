// ======================================================================
// مؤشر الأداء، ودرجات الإشراف ومؤشره، والتقييم السنوي — دوال صافية
// ----------------------------------------------------------------------
// مؤشر الأداء نسبة: ما حصّله المنسق ÷ أقصى ما أتاحته دوراته هو. فقلّة
// الدورات المسندة لا تُنقصه، وإتقان القليل يتقدّم على الإخلال بالكثير.
//
// المشرف يعمل عملين: عمله منسقاً عمل كامل يُقيَّم بالمعادلة نفسها، ويُضاف
// إليه ربع مؤشر إشرافه (بسقف ١٠٠) — فإتقان الإشراف يعوّض ما خسره منسقاً.
// ======================================================================
const { POINTS: P, EVALUATION_DEFAULTS, ratingOf } = require('./points.rules');

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
const clamp = (n) => Math.max(0, Math.min(100, n));
const EXCELLENCE_CATS = new Set(['documentation', 'collaboration', 'initiative']);

/** متوسط موزون للمكوّنات المتاحة فقط — المكوّن بلا بيانات يُوزَّع وزنه على غيره */
function weighted(parts) {
  const ok = parts.filter((p) => p.value != null && p.weight > 0);
  const w = ok.reduce((s, p) => s + p.weight, 0);
  return w ? ok.reduce((s, p) => s + p.value * p.weight, 0) / w : null;
}

/** مكوّنات مؤشر التنسيق من سجل منسق */
function coordinationParts(entries, { assignments = [], courses = [], userId, now = new Date(), excellenceFull = EVALUATION_DEFAULTS.excellenceFull }) {
  // ١. التنفيذ: العناصر والجودة والإقفال منسوبةً إلى أقصى الممكن
  let earned = 0;
  let possible = 0;
  for (const e of entries) {
    if (e.category === 'element' && e.status) { earned += e.points; possible += e.base || P.elementBase; }
    else if (e.category === 'quality') earned += e.points;
    else if (e.category === 'closure') { earned += e.points; possible += P.closureOnTime; }
  }
  const execution = possible ? clamp((earned / possible) * 100) : null;

  // ٢. تسجيل الدورات المسندة: ما سُجّل ÷ ما أُسند (بعد انقضاء الشهر)
  let assigned = 0;
  let registered = 0;
  for (const a of assignments) {
    if (a.userId !== userId || !a.periodEnd || new Date(a.periodEnd) > now || !a.assignedCoursesCount) continue;
    const s = new Date(a.periodStart).getTime();
    const e = new Date(a.periodEnd).getTime();
    const n = courses.filter((c) => c.primaryEmployeeId === userId && c.startDate && new Date(c.startDate).getTime() >= s && new Date(c.startDate).getTime() <= e).length;
    assigned += a.assignedCoursesCount;
    registered += Math.min(n, a.assignedCoursesCount);
  }
  const registration = assigned ? clamp((registered / assigned) * 100) : null;

  // ٣. التميّز والتعاون: ما كسبه منها حتى «الدرجة الكاملة» المحددة
  const exPts = entries.filter((e) => EXCELLENCE_CATS.has(e.category) && e.points > 0).reduce((s, e) => s + e.points, 0);
  const excellence = clamp((exPts / (excellenceFull || 100)) * 100);

  return { execution: r1(execution), registration: r1(registration), excellence: r1(excellence), earned: r1(earned), possible, assigned, registered, excellencePoints: r1(exPts) };
}

/**
 * درجات الإشراف: سرعة البتّ، وإقفال دورات الفريق، وما فات موعده فيه، والبتّ في البلاغات.
 * decisions: [{ supervisorId, decidedAt, submittedAt, courseId, courseName, elementName, action }]
 */
function supervisionLedger({ supervisorId, teamCourseIds, decisions = [], coordEntries = [], blockerDecisions = [], start, end }) {
  const team = new Set(teamCourseIds);
  const out = [];
  const inYear = (d) => d && new Date(d) >= start && new Date(d) <= end;
  const push = (e) => { if (inYear(e.date) && e.points) out.push({ ...e, userId: supervisorId, category: 'supervision', points: r1(e.points), date: new Date(e.date) }); };

  for (const d of decisions) {
    if (d.supervisorId !== supervisorId || !d.submittedAt) continue;
    const hours = (new Date(d.decidedAt) - new Date(d.submittedAt)) / HOUR;
    let pts;
    let detail;
    if (hours <= 24) { pts = P.decisionWithinDay; detail = 'بتّ فيه خلال يوم'; }
    else if (hours <= 48) { pts = P.decisionWithinTwoDays; detail = 'بتّ فيه خلال يومين'; }
    else {
      const days = Math.ceil((hours - 48) / 24);
      pts = Math.max(P.decisionLateFloor, P.decisionLatePerDay * days);
      detail = `بتّ فيه بعد ${Math.ceil(hours / 24)} أيام من تقديمه`;
    }
    push({ date: d.decidedAt, points: pts, title: `البتّ في «${d.elementName || 'عنصر'}»`, detail, courseId: d.courseId, courseName: d.courseName, speedHours: hours });
  }
  for (const e of coordEntries) {
    if (!team.has(e.courseId)) continue;
    if (e.category === 'closure' && e.points === P.closureOnTime) push({ date: e.date, points: P.teamClosureOnTime, title: 'دورة في فريقك أُقفلت في موعدها', detail: e.courseName, courseId: e.courseId, courseName: e.courseName, teamClosure: true });
    if (e.category === 'element' && e.status === 'missing') push({ date: e.date, points: P.teamMissingElement, title: `«${e.title}» متأخر في فريقك`, detail: 'فات موعده الأقصى ولم يُقدَّم — تابعه مع منسقه', courseId: e.courseId, courseName: e.courseName });
  }
  for (const b of blockerDecisions) {
    if (b.decidedById !== supervisorId || !b.raisedAt) continue;
    if (new Date(b.decidedAt) - new Date(b.raisedAt) <= 2 * DAY) push({ date: b.decidedAt, points: P.blockerDecidedFast, title: 'بتّ في بلاغ عائق خلال يومين', detail: b.courseName || '', courseId: b.courseId, courseName: b.courseName });
  }
  return out;
}

/**
 * مؤشر الإشراف (من ١٠٠): سرعة البتّ، وإقفال دورات الفريق في موعدها، وأداء الفريق،
 * بأوزان يضبطها المدير (الافتراضي ٥٠ / ٢٥ / ٢٥).
 */
function supervisionIndex({ decisions = [], supervisorId, teamCourseIds = [], coordEntries = [], teamExecution = [], weights = EVALUATION_DEFAULTS.supervision }) {
  const mine = decisions.filter((d) => d.supervisorId === supervisorId && d.submittedAt);
  const speedScores = mine.map((d) => {
    const h = (new Date(d.decidedAt) - new Date(d.submittedAt)) / HOUR;
    if (h <= 24) return 100;
    if (h <= 48) return 75;
    return Math.max(0, 75 - 15 * Math.ceil((h - 48) / 24));
  });
  const speed = speedScores.length ? speedScores.reduce((a, b) => a + b, 0) / speedScores.length : null;

  const team = new Set(teamCourseIds);
  const closures = coordEntries.filter((e) => e.category === 'closure' && team.has(e.courseId));
  const closure = closures.length ? (closures.filter((e) => e.points === P.closureOnTime).length / closures.length) * 100 : null;

  const vals = teamExecution.filter((v) => v != null);
  const teamPerf = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  const w = { ...EVALUATION_DEFAULTS.supervision, ...(weights || {}) };
  const index = weighted([{ value: speed, weight: w.speed }, { value: closure, weight: w.closure }, { value: teamPerf, weight: w.team }]);
  return {
    index: r1(index == null ? null : clamp(index)),
    speed: r1(speed), closure: r1(closure), team: r1(teamPerf),
    decisions: mine.length,
    avgHours: mine.length ? r1(mine.reduce((s, d) => s + (new Date(d.decidedAt) - new Date(d.submittedAt)) / HOUR, 0) / mine.length) : null,
  };
}

/**
 * التقييم السنوي.
 *   المنسق (ومعه المشرف الذي يتولى دورات بنفسه):
 *     مؤشر الأداء = التنفيذ والتسجيل والتميّز بأوزانها (+ حصة من مؤشر الإشراف للمشرف)
 *     التقييم السنوي = المكوّنات الأربعة مع تقدير المدير (+ الحصة نفسها)، بسقف ١٠٠
 *   المشرف المتفرّغ للإشراف (لا دورات له بنفسه):
 *     مؤشر الأداء = مؤشر الإشراف
 *     التقييم السنوي = مؤشر الإشراف بوزن المكوّنات الآلية مجتمعةً + تقدير المدير بوزنه
 */
function evaluate({ parts, supervision = null, managerRating = null, settings = EVALUATION_DEFAULTS }) {
  const w = { ...EVALUATION_DEFAULTS.weights, ...(settings.weights || {}) };
  const share = (settings.supervisorShare ?? EVALUATION_DEFAULTS.supervisorShare) / 100;
  const auto = [
    { value: parts.execution, weight: w.execution },
    { value: parts.registration, weight: w.registration },
    { value: parts.excellence, weight: w.excellence },
  ];
  const coordAuto = weighted(auto);
  const bonus = supervision?.index != null ? supervision.index * share : 0;
  const performance = coordAuto == null ? null : clamp(coordAuto + bonus);

  const rating = managerRating == null || managerRating === '' ? null : clamp(Number(managerRating));

  // المشرف المتفرّغ (لا عناصر مستحقة عليه ولا دورات مسندة): يُقاس بإشرافه وحده
  if (parts.execution == null && parts.registration == null && supervision?.index != null) {
    const autoWeight = w.execution + w.registration + w.excellence;
    const final = weighted([{ value: supervision.index, weight: autoWeight }, { value: rating, weight: w.manager }]);
    return {
      track: 'supervisor',
      performance: r1(supervision.index),
      coordination: null,
      supervisionBonus: 0,
      managerRating: rating,
      final: r1(final == null ? null : clamp(final)),
      provisional: rating == null,
      rating: ratingOf(final == null ? null : clamp(final)),
    };
  }

  const coordFull = weighted([...auto, { value: rating, weight: w.manager }]);
  const final = coordFull == null ? null : clamp(coordFull + bonus);
  return {
    track: supervision ? 'coordinator-supervisor' : 'coordinator',
    performance: r1(performance),
    coordination: r1(coordAuto),
    supervisionBonus: r1(bonus),
    managerRating: rating,
    final: r1(final),
    provisional: rating == null,
    rating: ratingOf(final),
  };
}

module.exports = { coordinationParts, supervisionLedger, supervisionIndex, evaluate, weighted };
