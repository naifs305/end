// =============================================================
// «رصيد الإنجاز» — حالات الاستخدام (Service)
// -------------------------------------------------------------
// • الرصيد سنوي ويُحسب من الواقع لحظة الطلب، فما ينجزه المنسق يظهر
//   في رصيده مباشرة بسطر يشرح سببه.
// • السنة المنقضية تُحفظ كما هي (أرشيف) فيُرجع إليها ولو تغيّرت القواعد.
// • الشفافية: كل منسق يرى سجله كاملاً، وترتيب الجميع بالمجموع.
// =============================================================
const crypto = require('crypto');
const repo = require('./points.repo');
const engine = require('./points.engine');
const evaluation = require('./points.evaluation');
const config = require('../config/config.service');
const rules = require('./points.rules');
const permissions = require('../../services/permissions');
const { computeElementDeadlines } = require('../../shared/deadlines');
const { AppError } = require('../../shared/AppError');

const P = rules.POINTS;
const CACHE_MS = 20 * 1000;
const cache = new Map(); // year → { at, data }

const yearRange = (year) => ({ start: new Date(year, 0, 1, 0, 0, 0, 0), end: new Date(year, 11, 31, 23, 59, 59, 999) });
const monthRange = (label) => {
  const [y, m] = String(label).split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59, 999) };
};
const nameOf = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

// ── تحدي الشهر: مقاييس تُحسب من سجل الدرجات نفسه ──
const CHALLENGE_METRICS = {
  ideal_submissions: { label: 'عناصر قُدّمت قبل الموعد المثالي', unit: 'عنصر' },
  closures_on_time: { label: 'دورات أُقفلت في موعدها', unit: 'دورة' },
  documentations: { label: 'دورات وُثّقت', unit: 'توثيق' },
  team_points: { label: 'مجموع درجات الفريق في الشهر', unit: 'درجة' },
  zero_late: { label: 'عناصر متأخرة عن موعدها الأقصى (الهدف ألا تتجاوز)', unit: 'عنصر', lowerIsBetter: true },
};
// مقاييس الإصدار السابق تُقرأ بأقرب مقياس لها
const LEGACY_METRIC = { timeliness: 'ideal_submissions', quality: 'zero_late', zero_returns: 'zero_late', final_score: 'team_points', all_before_ideal: 'ideal_submissions' };

function challengeMeasure(metric, entries) {
  const m = CHALLENGE_METRICS[metric] ? metric : LEGACY_METRIC[metric] || 'team_points';
  let value = 0;
  const by = new Map();
  const add = (uid, v) => by.set(uid, (by.get(uid) || 0) + v);
  for (const e of entries) {
    let v = 0;
    if (m === 'ideal_submissions' && e.category === 'element' && e.status === 'ideal') v = 1;
    else if (m === 'closures_on_time' && e.category === 'closure' && e.points === P.closureOnTime) v = 1;
    else if (m === 'documentations' && e.category === 'documentation' && e.title === 'توثيق الدورة') v = 1;
    else if (m === 'team_points') v = e.points;
    else if (m === 'zero_late' && e.category === 'element' && ['late', 'missing'].includes(e.status)) v = 1;
    if (v) { value += v; add(e.userId, v); }
  }
  return { metric: m, value: Math.round(value * 10) / 10, contributions: by };
}

function challengeAchieved(challenge, measure, monthEnded) {
  const meta = CHALLENGE_METRICS[measure.metric];
  const target = Number(challenge.targetValue) || 0;
  if (meta?.lowerIsBetter) return monthEnded && measure.value <= target;
  return measure.value >= target;
}

/** يحسب سجل السنة لكل المنسقين (مع مكافآت تحدي الشهر) */
async function computeYear(year, now = new Date()) {
  const hit = cache.get(year);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const { start, end } = yearRange(year);
  const calcNow = now < end ? now : end;
  const [users, courses] = await Promise.all([repo.findCoordinators(), repo.findCourses(start, end)]);
  const [decisions, docs, certs, closureReviews, fieldReports, optionalReports, ideas, badges, assignments, rejected, challenges] = await Promise.all([
    repo.findDecisionHistory(courses.map((c) => c.id)),
    repo.findDocumentations(),
    repo.findCertReviews(),
    repo.findClosureReviews(start, end),
    repo.findFieldReports(start, end),
    repo.findOptionalReports(start, end),
    repo.findIdeas(),
    repo.findManualBadges(start, end),
    repo.findAssignments(start, end),
    repo.findRejectedBlockers(start, end),
    repo.findChallenges(start, end),
  ]);

  const history = new Map();
  for (const d of decisions) {
    const key = `${d.courseId}|${d.details?.elementKey}`;
    const h = history.get(key) || { returned: 0, rejected: 0 };
    if (d.action === 'ELEMENT_RETURNED') h.returned += 1; else h.rejected += 1;
    history.set(key, h);
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const courseOwner = new Map(courses.map((c) => [c.id, c.primaryEmployeeId]));

  const entries = engine.buildLedger({
    start, end, now: calcNow, courses, history,
    userIds: users.map((u) => u.id),
    documentations: docs.map((d) => ({
      courseId: d.courseId, courseName: d.course?.name, ownerId: d.course?.primaryEmployeeId,
      sessions: (d.sessions || []).filter((s) => String(s.description || '').trim().length >= 20).length,
      photos: d._count?.media || 0, starAwarded: d.starAwarded, starAwardedAt: d.starAwardedAt,
      documentedAt: d.updatedAt, updatedAt: d.updatedAt,
    })),
    certReviews: certs.map((t) => t.formData?.certReview).map((cr, i) => cr && cr.reviewerId && cr.respondedAt ? {
      reviewerId: cr.reviewerId, respondedAt: cr.respondedAt, courseId: certs[i].courseId, courseName: certs[i].course?.name,
      ownerName: nameOf(userById.get(courseOwner.get(certs[i].courseId))),
    } : null).filter(Boolean),
    closureReviews: closureReviews.map((c) => ({ ...c, courseName: c.course?.name })),
    fieldReports,
    optionalReports: optionalReports.map((o) => ({ ...o, courseName: o.course?.name })),
    ideas,
    badges: badges.map((b) => ({ ...b, label: b.note || 'شارة تقدير من المدير' })),
    assignments,
    rejectedBlockers: rejected.filter((b) => b.decidedById !== b.raisedById).map((b) => ({ ...b, note: b.decisionNote, courseName: b.course?.name })),
  });

  // مكافأة تحدي الشهر: لكل منسق أسهم في الشهر بعمل
  const challengeView = [];
  for (const ch of challenges) {
    const { start: ms, end: me } = monthRange(ch.periodLabel);
    const monthEntries = entries.filter((e) => e.date >= ms && e.date <= me);
    const measure = challengeMeasure(ch.targetMetric, monthEntries);
    const monthEnded = calcNow > me;
    const achieved = ch.status !== 'CANCELLED' && challengeAchieved(ch, measure, monthEnded);
    challengeView.push({ id: ch.id, periodLabel: ch.periodLabel, achieved, value: measure.value });
    if (!achieved) continue;
    const participants = new Set(monthEntries.filter((e) => e.points > 0).map((e) => e.userId));
    const when = monthEnded ? me : calcNow;
    for (const uid of participants) {
      entries.push({ userId: uid, date: when, category: 'initiative', points: P.challengeAchieved, title: 'تحقيق تحدي الشهر', detail: `حقق الفريق تحدي «${ch.title}»` });
    }
  }
  // ── الإشراف: درجات تُضاف فوق درجات التنسيق ──
  const [sup, logs, blockerDecisions] = await Promise.all([
    repo.findSupervision(), repo.findDecisionLogs(start, end), repo.findBlockerDecisions(start, end),
  ]);
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const approvalDecisions = [];
  const lastSubmit = new Map();
  for (const l of logs) {
    const key = `${l.courseId}|${l.details?.elementKey}`;
    if (l.action === 'ELEMENT_SUBMITTED') { lastSubmit.set(key, l.createdAt); continue; }
    if (l.createdAt < start || l.createdAt > end) continue;
    approvalDecisions.push({
      supervisorId: l.userId, decidedAt: l.createdAt, submittedAt: lastSubmit.get(key) || null,
      courseId: l.courseId, courseName: courseById.get(l.courseId)?.name, elementName: l.details?.elementName, action: l.action,
    });
  }
  const followedBy = new Map(sup.followed.map((u) => [u.id, u.followUpSupervisorId]));
  const collaborators = new Set(sup.followed.map((u) => u.id));
  const supervision = new Map();
  const coordEntries = entries.slice();
  for (const sid of sup.supervisorIds) {
    const projects = new Set(sup.links.filter((l) => l.userId === sid).map((l) => l.operationalProjectId));
    // الخارجية تُحتسب لمشرف مشروع منسّقها، كما في صلاحية الاعتماد
    const teamCourses = courses.filter((c) => c.primaryEmployeeId !== sid && (
      (projects.has(permissions.reviewProjectIdOf(c, c.primaryEmployee)) && !collaborators.has(c.primaryEmployeeId)) || followedBy.get(c.primaryEmployeeId) === sid
    ));
    const teamCourseIds = teamCourses.map((c) => c.id);
    const members = Array.from(new Set(teamCourses.map((c) => c.primaryEmployeeId).filter(Boolean)));
    supervision.set(sid, { teamCourseIds, members });
    entries.push(...evaluation.supervisionLedger({ supervisorId: sid, teamCourseIds, decisions: approvalDecisions, coordEntries, blockerDecisions: blockerDecisions.map((b) => ({ ...b, courseName: b.course?.name })), start, end }));
  }
  entries.sort((a, b) => b.date - a.date);

  const data = { year, start, end, now: calcNow, users, entries, courses, challengeView, supervision, decisions: approvalDecisions, assignments };
  cache.set(year, { at: Date.now(), data });
  return data;
}

function invalidate() { cache.clear(); }

/** أوزان التقييم من إعدادات التشغيل، والافتراضي لما لم يُضبط */
async function evaluationSettings() {
  const D = rules.EVALUATION_DEFAULTS;
  const num = async (key, fallback) => {
    const v = Number(await config.getSetting(key, ''));
    return Number.isFinite(v) && String(await config.getSetting(key, '')).trim() !== '' && v >= 0 ? v : fallback;
  };
  return {
    weights: {
      execution: await num('evaluation.weight.execution', D.weights.execution),
      registration: await num('evaluation.weight.registration', D.weights.registration),
      excellence: await num('evaluation.weight.excellence', D.weights.excellence),
      manager: await num('evaluation.weight.manager', D.weights.manager),
    },
    supervisorShare: await num('evaluation.supervisorShare', D.supervisorShare),
    excellenceFull: await num('evaluation.excellenceFull', D.excellenceFull) || D.excellenceFull,
  };
}

/** مؤشر كل منسق ومشرف وتقييمه السنوي */
function evaluateAll(data, settings, ratings = new Map()) {
  const byUser = new Map(data.users.map((u) => [u.id, []]));
  for (const e of data.entries) if (byUser.has(e.userId)) byUser.get(e.userId).push(e);
  const parts = new Map();
  for (const u of data.users) {
    const coord = (byUser.get(u.id) || []).filter((e) => e.category !== 'supervision');
    parts.set(u.id, evaluation.coordinationParts(coord, { assignments: data.assignments, courses: data.courses, userId: u.id, now: data.now, excellenceFull: settings.excellenceFull }));
  }
  const out = new Map();
  for (const u of data.users) {
    const team = data.supervision?.get(u.id);
    const sup = team ? evaluation.supervisionIndex({
      decisions: data.decisions, supervisorId: u.id, teamCourseIds: team.teamCourseIds,
      coordEntries: data.entries.filter((e) => e.category !== 'supervision'),
      teamExecution: team.members.filter((m) => m !== u.id).map((m) => parts.get(m)?.execution ?? null),
    }) : null;
    const ev = evaluation.evaluate({ parts: parts.get(u.id), supervision: sup, managerRating: ratings.get(u.id) ?? null, settings });
    out.set(u.id, { parts: parts.get(u.id), supervision: sup, isSupervisor: !!team, ...ev });
  }
  return out;
}

/** نطاق من يراهم صاحب الطلب: المنسق نفسه والجميع للترتيب، والمشرف فريقه */
async function scopeUserIds(user, activeRole, users) {
  if (activeRole === 'MANAGER') return users.map((u) => u.id);
  if (activeRole === 'PROJECT_SUPERVISOR') {
    const where = await permissions.buildUsersWhere(user, activeRole, {});
    const team = await repo.findCoordinators(where);
    return Array.from(new Set([...team.map((u) => u.id), user.id]));
  }
  return [user.id];
}

function rowsFor(data, evals = new Map()) {
  const byUser = new Map(data.users.map((u) => [u.id, []]));
  for (const e of data.entries) if (byUser.has(e.userId)) byUser.get(e.userId).push(e);
  const rows = data.users.map((u) => {
    const list = byUser.get(u.id) || [];
    const s = engine.summarize(list);
    const coursesCount = new Set(list.filter((e) => e.category === 'course' && e.title === 'تنفيذ دورة').map((e) => e.courseId)).size;
    return {
      userId: u.id, name: nameOf(u), project: u.operationalProject?.name || null, isCollaborator: !!u.isCollaborator,
      ...s, coursesCount, level: rules.levelOf(s.total),
      supervisionPoints: Math.round(list.filter((e) => e.category === 'supervision').reduce((a, e) => a + e.points, 0) * 10) / 10,
      evaluation: evals.get(u.id) || null,
      performance: evals.get(u.id)?.performance ?? null,
      isSupervisor: !!evals.get(u.id)?.isSupervisor,
    };
  });
  // الترتيب بمؤشر الأداء (لا يتأثر بعدد الدورات المسندة)، ثم بالرصيد
  rows.sort((a, b) => (b.performance ?? -1) - (a.performance ?? -1) || b.total - a.total);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

async function loadYear(year) {
  const current = new Date().getFullYear();
  if (year < current) {
    const archived = await repo.findArchive(year);
    if (archived.length) {
      return {
        archived: true,
        archivedAt: archived[0].archivedAt,
        rows: archived.map((a) => ({ ...a.summary, userId: a.userId, total: a.total, rank: a.rank, level: rules.levelOf(a.total) })).sort((a, b) => a.rank - b.rank),
        entriesOf: (uid) => (archived.find((a) => a.userId === uid)?.entries || []).map((e) => ({ ...e, date: new Date(e.date) })),
      };
    }
  }
  const data = await computeYear(year);
  const [settings, ratingRows] = await Promise.all([evaluationSettings(), repo.findRatings(year)]);
  const ratings = new Map(ratingRows.map((r) => [r.userId, r.rating]));
  const evals = evaluateAll(data, settings, ratings);
  return {
    archived: false,
    data,
    settings,
    rows: rowsFor(data, evals),
    entriesOf: (uid) => data.entries.filter((e) => e.userId === uid),
  };
}

const parseYear = (y) => {
  const n = Number(y) || new Date().getFullYear();
  if (n < 2024 || n > 2100) throw AppError.badRequest('سنة غير صالحة', 'serverErrors.points.badYear');
  return n;
};

/** ترتيب السنة: يراه الجميع (الأسماء والمجاميع)، والمشرف يرى فريقه مميّزاً */
async function leaderboard(query, user, activeRole) {
  const year = parseYear(query.year);
  const y = await loadYear(year);
  const team = activeRole === 'EMPLOYEE' ? [user.id] : await scopeUserIds(user, activeRole, y.data?.users || y.rows.map((r) => ({ id: r.userId })));
  const teamSet = new Set(team);
  return {
    year, archived: y.archived, archivedAt: y.archivedAt || null,
    rows: y.rows.map((r) => {
      const inScope = activeRole === 'MANAGER' || teamSet.has(r.userId);
      const own = r.userId === user.id;
      const ev = r.evaluation;
      // تقدير المدير والتقييم النهائي للمدير ولصاحبه وحدهما
      const evaluationView = ev && (activeRole === 'MANAGER' || own) ? ev
        : ev ? { performance: ev.performance, coordination: ev.coordination, supervisionBonus: ev.supervisionBonus, parts: ev.parts, supervision: ev.supervision, isSupervisor: ev.isSupervisor } : null;
      return { ...r, inScope, evaluation: evaluationView };
    }),
    levels: rules.LEVELS.filter((l) => Number.isFinite(l.min)).map((l) => ({ key: l.key, name: l.name, min: l.min })),
    categories: rules.CATEGORIES,
  };
}

/** سجل منسق: كل درجة بسببها — له نفسه، ولمشرفه، وللمدير */
async function ledger(userId, query, user, activeRole) {
  const year = parseYear(query.year);
  const target = userId === 'me' ? user.id : userId;
  if (target !== user.id) {
    if (activeRole === 'EMPLOYEE') throw AppError.forbidden('سجل الدرجات لصاحبه ومشرفه والمدير', 'serverErrors.points.forbidden');
    const y0 = await computeYear(new Date().getFullYear());
    const scope = await scopeUserIds(user, activeRole, y0.users);
    if (!scope.includes(target)) throw AppError.forbidden('هذا المنسق خارج فريقك', 'serverErrors.points.forbidden');
  }
  const y = await loadYear(year);
  const row = y.rows.find((r) => r.userId === target) || null;
  const entries = y.entriesOf(target);
  const opportunities = !y.archived && year === new Date().getFullYear() ? await opportunitiesFor(target, y.data) : [];
  return {
    year, archived: y.archived, row, total: row?.total ?? 0, rank: row?.rank ?? null, of: y.rows.length,
    level: rules.levelOf(row?.total ?? 0),
    evaluation: row?.evaluation || null,
    performance: row?.performance ?? null,
    summary: engine.summarize(entries),
    entries: entries.slice(0, 600),
    opportunities,
    categories: rules.CATEGORIES,
  };
}

/** فرص قريبة: ما يرفع الرصيد الآن أو يوقف نزيفه */
async function opportunitiesFor(userId, data) {
  const now = new Date();
  const out = [];
  const docsByCourse = new Set(data.entries.filter((e) => e.category === 'documentation' && e.userId === userId).map((e) => `${e.courseId}|${e.title}`));
  const reviewed = new Set(data.entries.filter((e) => e.title === 'تقييم صعوبات الإقفال' && e.userId === userId).map((e) => e.courseId));
  for (const c of data.courses) {
    if (c.primaryEmployeeId !== userId) continue;
    for (const t of c.closureElements || []) {
      if (['APPROVED', 'NOT_APPLICABLE', 'PENDING_APPROVAL'].includes(t.status)) continue;
      const d = computeElementDeadlines(t, c, now);
      if (!d.hasDeadline || d.excludedFromTiming) continue;
      const critical = rules.CRITICAL_KEYS.has(t.element?.key);
      const base = P.elementBase * (critical ? 2 : 1);
      const name = t.element?.name || 'عنصر';
      if (now <= d.idealDeadline) {
        out.push({ kind: 'gain', points: base * (1 + P.idealBonusShare), courseId: c.id, courseName: c.name, title: `قدّم «${name}» قبل ${d.idealDeadline.toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long' })}`, detail: `تكسب ${base * (1 + P.idealBonusShare)} بدل ${base}`, due: d.idealDeadline });
      } else if (now <= d.maxDeadline) {
        out.push({ kind: 'gain', points: base, courseId: c.id, courseName: c.name, title: `قدّم «${name}» قبل موعده الأقصى`, detail: `تكسب ${base} — وبعده يبدأ الخصم`, due: d.maxDeadline });
      } else {
        out.push({ kind: 'stop', points: -base * P.latePerDayShare, courseId: c.id, courseName: c.name, title: `«${name}» متأخر — قدّمه الآن`, detail: `يُخصم ${base * P.latePerDayShare} عن كل يوم حتى يُقدَّم`, due: d.maxDeadline });
      }
    }
    if (['CLOSED', 'ARCHIVED'].includes(c.status)) {
      if (!docsByCourse.has(`${c.id}|توثيق الدورة`)) out.push({ kind: 'gain', points: P.documentation + P.documentationStar, courseId: c.id, courseName: c.name, title: 'وثّق الدورة', detail: `+${P.documentation} للتوثيق و+${P.documentationStar} للنجمة إن نشرته مكتملاً` });
      else if (!docsByCourse.has(`${c.id}|نجمة التميّز`)) out.push({ kind: 'gain', points: P.documentationStar, courseId: c.id, courseName: c.name, title: 'أكمل التوثيق وانشره', detail: `+${P.documentationStar} لنجمة التميّز` });
      if (!reviewed.has(c.id) && c.closedAt && now - new Date(c.closedAt) < 90 * 86400000) out.push({ kind: 'gain', points: P.closureReview, courseId: c.id, courseName: c.name, title: 'قيّم صعوبات الإقفال', detail: `+${P.closureReview} في دقيقة` });
    }
  }
  // مراجعات شهادات مسندة إليه لم يرد عليها
  for (const t of await repo.findOpenCertReviews()) {
    if (t.formData?.certReview?.reviewerId === userId) out.push({ kind: 'gain', points: P.certReview, courseId: t.courseId, courseName: t.course?.name, title: 'راجع شهادات زميلك', detail: `+${P.certReview} وتُعين زميلك على التقديم` });
  }
  const order = { stop: 0, gain: 1 };
  return out.sort((a, b) => order[a.kind] - order[b.kind] || (a.due ? new Date(a.due) : Infinity) - (b.due ? new Date(b.due) : Infinity)).slice(0, 12);
}

/** حفظ رصيد سنة كما هو — للرجوع إليه ولو تغيّرت القواعد */
async function archiveYear(year, actor = null) {
  const current = new Date().getFullYear();
  if (year >= current) throw AppError.badRequest('تُحفظ السنة بعد انقضائها', 'serverErrors.points.yearNotOver');
  invalidate();
  const data = await computeYear(year);
  const [settings, ratingRows] = await Promise.all([evaluationSettings(), repo.findRatings(year)]);
  const rows = rowsFor(data, evaluateAll(data, settings, new Map(ratingRows.map((r) => [r.userId, r.rating]))));
  const now = new Date();
  await repo.saveArchive(year, rows.map((r) => ({
    id: crypto.randomUUID(), year, userId: r.userId, total: r.total, rank: r.rank,
    summary: { name: r.name, project: r.project, byCategory: r.byCategory, byMonth: r.byMonth, gained: r.gained, lost: r.lost, count: r.count, coursesCount: r.coursesCount, evaluation: r.evaluation, performance: r.performance, isSupervisor: r.isSupervisor, supervisionPoints: r.supervisionPoints, settings },
    entries: data.entries.filter((e) => e.userId === r.userId).map((e) => ({ ...e, date: e.date.toISOString() })),
    rulesVersion: rules.RULES_VERSION, archivedAt: now, archivedById: actor?.id || null,
  })));
  return { year, saved: rows.length };
}

/** حفظ السنة الماضية تلقائياً إن لم تُحفظ (يُستدعى من المهمة اليومية) */
async function archivePreviousYearIfMissing() {
  const prev = new Date().getFullYear() - 1;
  const existing = await repo.findArchive(prev);
  if (existing.length) return { year: prev, saved: 0 };
  return archiveYear(prev);
}

async function years() {
  const archived = await repo.listArchivedYears();
  const current = new Date().getFullYear();
  const set = new Set([current, ...archived.map((a) => a.year)]);
  return Array.from(set).sort((a, b) => b - a);
}

/** تقدّم تحدي الشهر محسوباً من السجل نفسه */
async function challengeProgress(challenge) {
  if (!challenge) return null;
  const { start, end } = monthRange(challenge.periodLabel);
  const data = await computeYear(start.getFullYear());
  const monthEntries = data.entries.filter((e) => e.date >= start && e.date <= end && e.title !== 'تحقيق تحدي الشهر');
  const measure = challengeMeasure(challenge.targetMetric, monthEntries);
  const monthEnded = new Date() > end;
  const achieved = challengeAchieved(challenge, measure, monthEnded);
  const userById = new Map(data.users.map((u) => [u.id, u]));
  const contributors = Array.from(measure.contributions.entries())
    .map(([uid, v]) => ({ userId: uid, name: nameOf(userById.get(uid)), value: Math.round(v * 10) / 10 }))
    .sort((a, b) => b.value - a.value).slice(0, 10);
  const meta = CHALLENGE_METRICS[measure.metric];
  return {
    metric: measure.metric, metricLabel: meta.label, unit: meta.unit, lowerIsBetter: !!meta.lowerIsBetter,
    currentValue: measure.value, achieved, monthEnded, reward: P.challengeAchieved,
    status: achieved ? 'ACHIEVED' : monthEnded ? 'FAILED' : 'ACTIVE',
    contributors,
    daysLeft: monthEnded ? 0 : Math.ceil((end - new Date()) / 86400000),
  };
}

/** التقييم السنوي لكل الموظفين — للمدير */
async function evaluationReport(query, user, activeRole) {
  if (activeRole !== 'MANAGER') throw AppError.forbidden('التقييم السنوي للمدير', 'serverErrors.points.forbidden');
  const year = parseYear(query.year);
  const y = await loadYear(year);
  const settings = y.settings || (await evaluationSettings());
  return {
    year, archived: y.archived, settings,
    scale: rules.RATING_SCALE.map((r) => ({ grade: r.grade, name: r.name, min: Number.isFinite(r.min) ? r.min : 0 })),
    rows: y.rows.map((r) => ({
      userId: r.userId, name: r.name, project: r.project, isSupervisor: r.isSupervisor, total: r.total, rank: r.rank,
      coursesCount: r.coursesCount, level: r.level, evaluation: r.evaluation, supervisionPoints: r.supervisionPoints,
    })),
  };
}

/** ملف موظف واحد للطباعة: تقييمه ومكوّناته وسجل درجاته — للمدير ولصاحبه */
async function evaluationFile(userId, query, user, activeRole) {
  if (activeRole !== 'MANAGER' && userId !== user.id) throw AppError.forbidden('ملف التقييم للمدير ولصاحبه', 'serverErrors.points.forbidden');
  const year = parseYear(query.year);
  const y = await loadYear(year);
  const row = y.rows.find((r) => r.userId === userId);
  if (!row) throw AppError.notFound('لا تقييم لهذا الموظف في السنة', 'serverErrors.points.notFound');
  const entries = y.entriesOf(userId);
  return {
    year, archived: y.archived, settings: y.settings || (await evaluationSettings()),
    scale: rules.RATING_SCALE.map((r) => ({ grade: r.grade, name: r.name, min: Number.isFinite(r.min) ? r.min : 0 })),
    row, of: y.rows.length, summary: engine.summarize(entries), entries, categories: rules.CATEGORIES,
  };
}

/** تقدير المدير: خانة واحدة من ١٠٠ (فارغة = يُحذف) */
async function setRating(body, user, activeRole) {
  if (activeRole !== 'MANAGER') throw AppError.forbidden('تقدير المدير للمدير وحده', 'serverErrors.points.forbidden');
  const year = parseYear(body?.year);
  const userId = String(body?.userId || '');
  if (!userId) throw AppError.badRequest('الموظف مطلوب', 'serverErrors.points.userRequired');
  const raw = body?.rating;
  if (raw === null || raw === '' || raw === undefined) {
    await repo.deleteRating(year, userId);
    return { ok: true, rating: null };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw AppError.badRequest('التقدير رقم من ٠ إلى ١٠٠', 'serverErrors.points.badRating');
  await repo.upsertRating(year, userId, n, user.id);
  return { ok: true, rating: n };
}

module.exports = {
  evaluationReport, evaluationFile, setRating, evaluationSettings,
  computeYear, invalidate, leaderboard, ledger, archiveYear, archivePreviousYearIfMissing, years,
  challengeProgress, CHALLENGE_METRICS, rules: rules.describeRules,
};
