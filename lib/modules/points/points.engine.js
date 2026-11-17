// ======================================================================
// محرّك «رصيد الإنجاز» — دوال صافية بلا قاعدة بيانات
// ----------------------------------------------------------------------
// يأخذ ما وقع فعلاً (عناصر وتقديمات وإقفالات وتوثيق وتعاون ومبادرات)
// ويُخرج سجلاً: لكل درجة سطرٌ بصاحبها وتاريخها وسببها. الرصيد مجموع
// سطور السنة، فيرى المنسق كل درجة كيف جاءت.
//
// الإنصاف من المصدر الواحد للمواعيد: مدة البلاغ المقبول لا تُحتسب،
// والتمديد يُزيح الموعد، والعنصر المستثنى أو الموقوف أو غير المنطبق
// لا له ولا عليه.
// ======================================================================
const { computeElementDeadlines } = require('../../shared/deadlines');
const { lateDays } = require('../kpi/kpi.model');
const { POINTS: P, CRITICAL_KEYS, DOCUMENTATION_MIN } = require('./points.rules');

const r1 = (n) => Math.round(n * 10) / 10;
const fmtDays = (d) => (d === 1 ? 'يوماً واحداً' : d === 2 ? 'يومين' : d <= 10 ? `${d} أيام` : `${d} يوماً`);

function inRange(date, start, end) {
  const t = new Date(date).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/** درجة التوقيت لعنصر: { points, status, lateDays } أو null إن لم يُستحق */
function elementTiming(tracking, course, now) {
  const critical = CRITICAL_KEYS.has(tracking.element?.key);
  const base = P.elementBase * (critical ? 2 : 1);
  const d = computeElementDeadlines(tracking, course, now);
  const working = !!tracking.element?.isDeadlineWorkingDays;
  const late = (days) => Math.max(base * P.lateFloorShare, base - base * P.latePerDayShare * days);

  if (tracking.executionAt) {
    const at = new Date(tracking.executionAt);
    if (!d.hasDeadline || d.excludedFromTiming) return { points: base, status: 'untimed', lateDays: 0, base, critical, date: at };
    if (at <= d.idealDeadline) return { points: base * (1 + P.idealBonusShare), status: 'ideal', lateDays: 0, base, critical, date: at };
    if (at <= d.maxDeadline) return { points: base, status: 'withinMax', lateDays: 0, base, critical, date: at };
    const days = lateDays(d.maxDeadline, at, working);
    return { points: late(days), status: 'late', lateDays: days, base, critical, date: at };
  }
  if (!d.hasDeadline || d.excludedFromTiming || now <= d.maxDeadline) return null;
  const days = lateDays(d.maxDeadline, now, working);
  return { points: late(days), status: 'missing', lateDays: days, base, critical, date: d.maxDeadline };
}

/** أبعد موعد أقصى بين عناصر الدورة المنطبقة = موعد إقفالها */
function closureDeadline(course, now) {
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

/**
 * يبني سجل الدرجات لسنة.
 * @returns {Array<{userId,date,category,points,title,detail,courseId,courseName}>}
 */
function buildLedger(input) {
  const {
    start, end, now = new Date(),
    courses = [], history = new Map(), documentations = [],
    certReviews = [], closureReviews = [], fieldReports = [], optionalReports = [],
    ideas = [], badges = [], assignments = [], rejectedBlockers = [],
    userIds = null,
  } = input;
  const allowed = userIds ? new Set(userIds) : null;
  const out = [];
  const push = (e) => {
    if (!e.userId || (allowed && !allowed.has(e.userId))) return;
    if (!e.date || !inRange(e.date, start, end)) return;
    if (!e.points) return;
    out.push({ ...e, points: r1(e.points), date: new Date(e.date) });
  };

  for (const course of courses) {
    const owner = course.primaryEmployeeId;
    const cName = course.name;
    const base = { courseId: course.id, courseName: cName };

    // ── الدورة نفسها ──
    if (course.startDate && new Date(course.startDate) <= now) {
      push({ ...base, userId: owner, date: course.startDate, category: 'course', points: P.courseExecuted, title: 'تنفيذ دورة', detail: 'دورة مسجّلة في المنصة بدأ تنفيذها' });
    }
    if (course.createdAt && course.startDate && new Date(course.createdAt) < new Date(course.startDate) && !course.isLateEntry) {
      push({ ...base, userId: owner, date: course.createdAt, category: 'course', points: P.earlyRegistration, title: 'تسجيل مبكر', detail: 'سُجّلت الدورة قبل بدايتها' });
    }
    if (course.isLateEntry && course.lateEntryStatus === 'REJECTED') {
      push({ ...base, userId: owner, date: course.lateEntryDecidedAt || course.createdAt, category: 'discipline', points: P.lateEntryRejected, title: 'إدخال متأخر', detail: 'أُدخلت الدورة متأخرة ورُفض مبرر التأخر' });
    }

    // ── العناصر ──
    for (const t of course.closureElements || []) {
      if (t.status === 'NOT_APPLICABLE') continue;
      const timing = elementTiming(t, course, now);
      if (!timing) continue;
      const doer = t.executedById || owner;
      const elName = t.element?.name || 'عنصر';
      const label = timing.critical ? ' (حرج)' : '';
      const detail = {
        ideal: 'قُدّم قبل الموعد المثالي — درجته ومكافأة المبادرة',
        withinMax: 'قُدّم بين الموعد المثالي والأقصى',
        untimed: 'قُدّم (لا يُقاس توقيته: موعده مستثنى أو بلا موعد)',
        late: `قُدّم بعد الموعد الأقصى بـ${fmtDays(timing.lateDays)}`,
        missing: `لم يُقدَّم وفات موعده الأقصى بـ${fmtDays(timing.lateDays)} — يُخصم يومياً حتى يُقدَّم`,
      }[timing.status];
      push({ ...base, userId: timing.status === 'missing' ? owner : doer, date: timing.date, category: 'element', points: timing.points, title: `${elName}${label}`, detail, elementKey: t.element?.key, status: timing.status, base: timing.base });

      if (t.executionAt) {
        const h = history.get(`${course.id}|${t.element?.key}`) || {};
        const returned = h.returned || (t.status === 'RETURNED' ? 1 : 0);
        const rejected = h.rejected || (t.status === 'REJECTED' ? 1 : 0);
        if (returned) push({ ...base, userId: doer, date: t.executionAt, category: 'quality', points: timing.base * P.returnShare * returned, title: `${elName}: إعادة للتصحيح`, detail: returned === 1 ? 'أُعيد مرة للتصحيح' : `أُعيد ${returned} مرات للتصحيح` });
        if (rejected) push({ ...base, userId: doer, date: t.executionAt, category: 'quality', points: timing.base * P.rejectShare * rejected, title: `${elName}: رفض`, detail: 'رُفض العنصر' });
      }
    }

    // ── الإقفال ──
    const closed = ['CLOSED', 'ARCHIVED'].includes(course.status);
    const due = closureDeadline(course, now);
    if (closed) {
      const closedAt = new Date(course.closedAt || course.updatedAt);
      const days = due ? lateDays(due.deadline, closedAt, due.working) : 0;
      const pts = days ? Math.max(P.closureFloor, P.closureOnTime + P.closureLatePerDay * days) : P.closureOnTime;
      push({ ...base, userId: owner, date: closedAt, category: 'closure', points: pts, title: 'إقفال الدورة', detail: days ? `أُقفلت بعد موعدها بـ${fmtDays(days)}` : 'أُقفلت في موعدها' });
    } else if (due && now > due.deadline) {
      const days = lateDays(due.deadline, now, due.working);
      push({ ...base, userId: owner, date: due.deadline, category: 'closure', points: Math.max(P.closureFloor, P.closureLatePerDay * days), title: 'دورة لم تُقفل', detail: `تجاوزت موعد إقفالها بـ${fmtDays(days)} — يُخصم يومياً حتى تُقفل` });
    }
  }

  // ── التوثيق ──
  for (const d of documentations) {
    const base = { userId: d.ownerId, courseId: d.courseId, courseName: d.courseName, category: 'documentation' };
    const enough = (d.sessions || 0) >= DOCUMENTATION_MIN.sessions && (d.photos || 0) >= DOCUMENTATION_MIN.photos;
    if (enough || d.starAwarded) push({ ...base, date: d.documentedAt || d.updatedAt, points: P.documentation, title: 'توثيق الدورة', detail: 'وُثّقت الدورة بالجلسات والصور' });
    if (d.starAwarded) push({ ...base, date: d.starAwardedAt || d.updatedAt, points: P.documentationStar, title: 'نجمة التميّز', detail: 'نُشر التوثيق مكتملاً فنال النجمة' });
  }

  // ── التعاون ──
  for (const c of certReviews) push({ userId: c.reviewerId, date: c.respondedAt, category: 'collaboration', points: P.certReview, title: 'مراجعة شهادات زميل', detail: c.ownerName ? `راجع شهادات دورة ${c.ownerName}` : 'راجع شهادات دورة زميل', courseId: c.courseId, courseName: c.courseName });
  for (const c of closureReviews) push({ userId: c.authorId, date: c.createdAt, category: 'collaboration', points: P.closureReview, title: 'تقييم صعوبات الإقفال', detail: 'قيّم ما واجهه حتى أقفل الدورة', courseId: c.courseId, courseName: c.courseName });
  for (const f of fieldReports) push({ userId: f.authorId, date: f.createdAt, category: 'collaboration', points: P.fieldReport, title: 'تقرير ميداني', detail: f.title || 'كتب تقريراً ميدانياً' });
  for (const o of optionalReports) push({ userId: o.authorId, date: o.createdAt, category: 'collaboration', points: P.optionalReport, title: 'تقرير اختياري', detail: o.title || 'قدّم تقريراً اختيارياً', courseId: o.courseId, courseName: o.courseName });

  // ── المبادرات والتقدير ──
  for (const i of ideas) {
    const base = { userId: i.userId, category: 'initiative' };
    push({ ...base, date: i.createdAt, points: P.ideaSubmitted, title: 'مبادرة تطوير', detail: `قدّم مبادرة «${i.title}»` });
    if (['APPROVED', 'IMPLEMENTED'].includes(i.status)) push({ ...base, date: i.reviewedAt || i.updatedAt, points: P.ideaApproved, title: 'اعتماد مبادرة', detail: `اعتُمدت مبادرة «${i.title}»` });
    if (i.status === 'IMPLEMENTED') push({ ...base, date: i.implementedAt || i.updatedAt, points: P.ideaImplemented, title: 'تنفيذ مبادرة', detail: `نُفّذت مبادرة «${i.title}»` });
  }
  for (const b of badges) push({ userId: b.userId, date: b.awardedAt, category: 'initiative', points: P.managerRecognition, title: 'تقدير من الإدارة', detail: b.label || 'شارة تقدير' });

  // ── الانضباط ──
  for (const b of rejectedBlockers) push({ userId: b.raisedById, date: b.decidedAt, category: 'discipline', points: P.rejectedBlocker, title: 'بلاغ عائق غير صحيح', detail: b.note ? `رُفض البلاغ: ${b.note}` : 'رُفض البلاغ لعدم صحته', courseId: b.courseId, courseName: b.courseName });

  // دورات مسندة لم تُسجَّل: تُقارن بعد انقضاء الشهر بما سُجّل فيه
  for (const a of assignments) {
    if (!a.periodEnd || new Date(a.periodEnd) > now) continue;
    const registered = courses.filter((c) => c.primaryEmployeeId === a.userId
      && c.startDate && inRange(c.startDate, new Date(a.periodStart), new Date(a.periodEnd))).length;
    const missing = Math.max(0, (a.assignedCoursesCount || 0) - registered);
    if (missing) push({ userId: a.userId, date: a.periodEnd, category: 'course', points: P.unregisteredCourse * missing, title: 'دورات مسندة لم تُسجَّل', detail: `أُسند إليه ${a.assignedCoursesCount} في ${a.periodLabel} وسجّل ${registered}` });
  }

  return addStreaks(out);
}

/** سلسلة الالتزام: كل ١٠ عناصر متتالية في موعدها +١٠ */
function addStreaks(entries) {
  const byUser = new Map();
  for (const e of entries) {
    if (e.category !== 'element' || !['ideal', 'withinMax', 'late'].includes(e.status)) continue;
    const arr = byUser.get(e.userId) || [];
    arr.push(e);
    byUser.set(e.userId, arr);
  }
  const extra = [];
  for (const [userId, list] of byUser) {
    list.sort((a, b) => a.date - b.date);
    let run = 0;
    for (const e of list) {
      if (e.status === 'late') { run = 0; continue; }
      run += 1;
      if (run % P.streakSize === 0) extra.push({ userId, date: e.date, category: 'element', points: P.commitmentStreak, title: 'سلسلة التزام', detail: `${run} عناصر متتالية في موعدها` });
    }
  }
  return entries.concat(extra).sort((a, b) => b.date - a.date);
}

/** يلخّص سجل منسق: المجموع، وحسب الفئة، والشهر */
function summarize(entries) {
  const byCategory = {};
  const byMonth = {};
  let total = 0;
  let gained = 0;
  let lost = 0;
  for (const e of entries) {
    total += e.points;
    if (e.points > 0) gained += e.points; else lost += e.points;
    byCategory[e.category] = r1((byCategory[e.category] || 0) + e.points);
    const m = new Date(e.date).getMonth() + 1;
    byMonth[m] = r1((byMonth[m] || 0) + e.points);
  }
  return { total: r1(total), gained: r1(gained), lost: r1(lost), byCategory, byMonth, count: entries.length };
}

module.exports = { buildLedger, summarize, elementTiming, closureDeadline, addStreaks };
