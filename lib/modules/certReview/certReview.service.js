// ======================================================================
// مراجعة الشهادات بعين ثانية — شرط لتقديم عنصر «إصدار الشهادات»
// ----------------------------------------------------------------------
// لا يُقدَّم العنصر حتى يُسند المنسق مراجعة الشهادات لمنسق آخر، ويؤكد
// المراجِع أنه راجعها. وإن وجد ملاحظات أعادها بها، فيصحح المنسق ثم يعيد
// إرسالها للمراجعة. ويتحقق الخادم من التأكيد عند التقديم.
//
// formData.certReview = {
//   status: 'ASSIGNED' | 'CONFIRMED' | 'RETURNED',
//   reviewerId, reviewerName, assignedById, assignedAt, link, note,
//   respondedAt, reviewerNote, rounds,
//   history: [{ type: 'assigned'|'confirmed'|'returned', at, reviewerId, reviewerName, byId, note, round }]
// }
// formData.certFiles = [{ key, name, size, type, at }]  — الشهادات المرفقة للمراجعة،
//   تُحذف من المخزن بعد تأكيد المراجع سلامتها (لا تبقى نسخ شهادات في المنصة).

// ======================================================================
const repo = require('../closure/closure.repo');
const permissions = require('../../services/permissions');
const prisma = require('../../db/prisma');
const store = require('../../storage/mediaStore');

const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const FILE_TYPES = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const pushHistory = (review, event) => [...(Array.isArray(review?.history) ? review.history : []), event].slice(-30);

const ELEMENT_KEY = 'certificates';
const LOCKED = ['APPROVED', 'PENDING_APPROVAL', 'NOT_APPLICABLE'];

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

const str = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const fullName = (u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim();

/** رابط http(s) صالح، وإلا فارغ */
function cleanUrl(v) {
  const s = str(v, 600);
  if (!s) return '';
  try {
    const u = new URL(s);
    return ['http:', 'https:'].includes(u.protocol) ? u.toString() : '';
  } catch {
    return '';
  }
}

/** هل اكتملت المراجعة؟ — يستدعيه التقديم */
function isConfirmed(formData) {
  return formData?.certReview?.status === 'CONFIRMED' && !!formData.certReview.respondedAt;
}

async function load(trackingId) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);
  if (!item) throw httpError(404, 'العنصر غير موجود', 'serverErrors.closureElements.notFound');
  if (item.element.key !== ELEMENT_KEY) throw httpError(400, 'هذا العنصر ليس إصدار الشهادات', 'serverErrors.certReview.notCertificates');
  return item;
}

async function notify(userId, title, message, course) {
  try {
    const { createNotification } = require('../../services/notifications');
    await createNotification(userId, 'CERT_REVIEW', title, message, { courseId: course.id, courseName: course.name });
  } catch { /* الإشعار لا يعطّل العمل */ }
}

/** المراجِعون المتاحون: منسقون نشطون غير منسق الدورة ومن يُسند */
async function candidates(course, user) {
  const rows = await prisma.user.findMany({
    where: { isActive: true, roles: { has: 'EMPLOYEE' }, id: { notIn: [course.primaryEmployeeId, user.id].filter(Boolean) } },
    select: { id: true, firstName: true, lastName: true },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });
  return rows.map((u) => ({ id: u.id, name: fullName(u) }));
}

async function get(trackingId, user, activeRole) {
  const item = await load(trackingId);
  const review = item.formData?.certReview || null;
  const isReviewer = !!review && review.reviewerId === user.id;
  if (!isReviewer && !(await permissions.canViewCourse(user, activeRole, item.course))) {
    throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  }
  const canAssign = !LOCKED.includes(item.status) && await permissions.canSubmitElement(user, activeRole, item.course);
  return {
    review,
    files: (item.formData?.certFiles || []).map(({ key, name, size, type, at }) => ({ key, name, size, type, at })),
    canAssign,
    isReviewer,
    canRespond: isReviewer && review.status === 'ASSIGNED',
    candidates: canAssign ? await candidates(item.course, user) : [],
    course: { id: item.course.id, name: item.course.name },
  };
}

/** إسناد المراجعة (أو إعادة إرسالها بعد التصحيح) */
async function assign(trackingId, dto, user, activeRole) {
  const item = await load(trackingId);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }
  if (LOCKED.includes(item.status)) throw httpError(400, 'العنصر مُقدَّم أو غير منطبق — لا تُسند مراجعته', 'serverErrors.certReview.locked');
  const reviewerId = String(dto?.reviewerId || '');
  if (!reviewerId) throw httpError(400, 'اختر المنسق المراجِع', 'serverErrors.certReview.reviewerRequired');
  if (reviewerId === user.id || reviewerId === item.course.primaryEmployeeId) {
    throw httpError(400, 'المراجِع منسق آخر غير منسق الدورة', 'serverErrors.certReview.selfReview');
  }
  const reviewer = await prisma.user.findUnique({ where: { id: reviewerId }, select: { id: true, firstName: true, lastName: true, isActive: true, roles: true } });
  if (!reviewer || !reviewer.isActive || !reviewer.roles.includes('EMPLOYEE')) {
    throw httpError(400, 'المراجِع يجب أن يكون منسقاً نشطاً', 'serverErrors.certReview.reviewerInvalid');
  }
  if (dto?.link && !cleanUrl(dto.link)) throw httpError(400, 'رابط الشهادات غير صالح — يبدأ بـ https://', 'serverErrors.certReview.badLink');
  // المراجع يحتاج ما يراجعه: الشهادات مرفقة أو رابطها
  if (!cleanUrl(dto?.link) && !(item.formData?.certFiles || []).length) {
    throw httpError(400, 'أرفق الشهادات أو ضع رابطها — ليتمكن المراجِع من مراجعتها', 'serverErrors.certReview.nothingToReview');
  }

  const previous = item.formData?.certReview || {};
  const review = {
    status: 'ASSIGNED',
    reviewerId: reviewer.id,
    reviewerName: fullName(reviewer),
    assignedById: user.id,
    assignedAt: new Date().toISOString(),
    link: cleanUrl(dto?.link),
    note: str(dto?.note, 600),
    respondedAt: null,
    reviewerNote: previous.status === 'RETURNED' ? previous.reviewerNote : null,
    rounds: (previous.rounds || 0) + 1,
  };
  review.history = pushHistory(previous, { type: 'assigned', at: review.assignedAt, reviewerId: reviewer.id, reviewerName: review.reviewerName, byId: user.id, round: review.rounds, files: (item.formData?.certFiles || []).length });
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certReview: review } },
  });
  await notify(
    reviewer.id,
    `📝 مراجعة شهادات دورة «${item.course.name}»`,
    `طلب منك ${fullName(user) || 'زميلك'} مراجعة شهادات الدورة قبل تقديمها. افتح الدورة وأكّد المراجعة أو أعدها بملاحظاتك.`,
    item.course,
  );
  return { review };
}

/** رد المراجِع: تأكيد المراجعة، أو إعادتها بملاحظات */
async function respond(trackingId, dto, user) {
  const item = await load(trackingId);
  const review = item.formData?.certReview;
  if (!review || review.reviewerId !== user.id) throw httpError(403, 'لست المراجِع المسند لهذه الشهادات', 'serverErrors.certReview.notReviewer');
  if (review.status !== 'ASSIGNED') throw httpError(400, 'لا توجد مراجعة بانتظارك على هذه الشهادات', 'serverErrors.certReview.notPending');
  const decision = dto?.decision === 'return' ? 'RETURNED' : dto?.decision === 'confirm' ? 'CONFIRMED' : null;
  if (!decision) throw httpError(400, 'اختر: تأكيد المراجعة أو إعادتها بملاحظات', 'serverErrors.certReview.badDecision');
  const note = str(dto?.note, 1000);
  if (decision === 'RETURNED' && note.length < 3) throw httpError(400, 'اكتب الملاحظات التي يصححها المنسق', 'serverErrors.certReview.noteRequired');

  const now = new Date().toISOString();
  const next = { ...review, status: decision, respondedAt: now, reviewerNote: note || null };
  const files = item.formData?.certFiles || [];
  next.history = pushHistory(review, {
    type: decision === 'CONFIRMED' ? 'confirmed' : 'returned', at: now, reviewerId: user.id, reviewerName: review.reviewerName,
    note: note || null, round: review.rounds || 1, hours: review.assignedAt ? Math.round(((Date.parse(now) - Date.parse(review.assignedAt)) / 36e5) * 10) / 10 : null,
    ...(decision === 'CONFIRMED' && files.length ? { filesDeleted: files.length } : {}),
  });
  // بعد التأكيد تُحذف الشهادات المرفقة من المخزن — انتهت الحاجة إليها
  if (decision === 'CONFIRMED') {
    for (const f of files) { try { await store.remove(f.key); } catch { /* المفقود لا يعطّل */ } }
  }
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certReview: next, ...(decision === 'CONFIRMED' ? { certFiles: [] } : {}) } },
  });
  const owner = review.assignedById || item.course.primaryEmployeeId;
  await notify(
    owner,
    decision === 'CONFIRMED' ? `✅ رُوجعت شهادات «${item.course.name}»` : `↩️ ملاحظات على شهادات «${item.course.name}»`,
    decision === 'CONFIRMED'
      ? `أكّد ${review.reviewerName} مراجعة الشهادات — يمكنك الآن تقديم عنصر «إصدار الشهادات».`
      : `أعاد ${review.reviewerName} الشهادات بملاحظات: ${note}. صحّحها ثم أعد إرسالها للمراجعة.`,
    item.course,
  );
  return { review: next };
}

/** المراجعات التي تنتظر المستخدم — لبطاقة لوحة التحكم */
async function mine(user) {
  const rows = await prisma.courseClosureTracking.findMany({
    where: {
      element: { key: ELEMENT_KEY },
      formData: { path: ['certReview', 'reviewerId'], equals: user.id },
    },
    select: { id: true, formData: true, course: { select: { id: true, name: true, endDate: true } } },
    take: 50,
  });
  return rows
    .filter((r) => r.formData?.certReview?.status === 'ASSIGNED')
    .map((r) => ({
      trackingId: r.id,
      courseId: r.course.id,
      courseName: r.course.name,
      endDate: r.course.endDate,
      assignedAt: r.formData.certReview.assignedAt,
      link: r.formData.certReview.link || '',
    }));
}

// ── المرفقات: يرفعها المنسق، ويراها المراجِع ومن يرى الدورة ──
async function canSeeFiles(item, user, activeRole) {
  const review = item.formData?.certReview;
  if (review?.reviewerId === user.id) return true;
  return permissions.canViewCourse(user, activeRole, item.course);
}

async function addFile(trackingId, dto, user, activeRole) {
  const item = await load(trackingId);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'المرفقات لمنسق الدورة وفريقها', 'serverErrors.closure.submitForbidden');
  }
  if (LOCKED.includes(item.status)) throw httpError(400, 'العنصر مُقدَّم أو غير منطبق', 'serverErrors.certReview.locked');
  if (item.formData?.certReview?.status === 'CONFIRMED') throw httpError(400, 'أُكّدت المراجعة — لا حاجة لمرفقات جديدة', 'serverErrors.certReview.alreadyConfirmed');
  const files = item.formData?.certFiles || [];
  if (files.length >= MAX_FILES) throw httpError(400, `الحد الأعلى ${MAX_FILES} ملفات`, 'serverErrors.certReview.tooManyFiles');
  const m = String(dto?.dataUrl || '').match(/^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/);
  const ext = m && FILE_TYPES[m[1]];
  if (!ext) throw httpError(400, 'الملف PDF أو صورة (PNG أو JPG)', 'serverErrors.certReview.badFileType');
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) throw httpError(400, 'حجم الملف أكبر من ٨ ميجابايت', 'serverErrors.certReview.fileTooBig');
  const key = store.newKey('certrev', ext);
  await store.save(key, buffer);
  const entry = { key, name: str(dto?.name, 140) || `شهادات.${ext}`, size: buffer.length, type: m[1], at: new Date().toISOString(), byId: user.id };
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certFiles: [...files, entry] } },
  });
  return { file: { key: entry.key, name: entry.name, size: entry.size, type: entry.type, at: entry.at } };
}

async function removeFile(trackingId, key, user, activeRole) {
  const item = await load(trackingId);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'المرفقات لمنسق الدورة وفريقها', 'serverErrors.closure.submitForbidden');
  }
  const files = item.formData?.certFiles || [];
  if (!files.some((f) => f.key === key)) throw httpError(404, 'الملف غير موجود', 'serverErrors.certReview.fileNotFound');
  try { await store.remove(key); } catch { /* المفقود لا يعطّل */ }
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), certFiles: files.filter((f) => f.key !== key) } },
  });
  return { ok: true };
}

async function fileForDownload(trackingId, key, user, activeRole) {
  const item = await load(trackingId);
  if (!(await canSeeFiles(item, user, activeRole))) throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  const f = (item.formData?.certFiles || []).find((x) => x.key === key);
  if (!f) throw httpError(404, 'الملف غير موجود — قد يكون حُذف بعد تأكيد المراجعة', 'serverErrors.certReview.fileNotFound');
  return { key: f.key, name: f.name, type: f.type };
}

// ── لوحة المراجعات ──
/** يحوّل مراجعة إلى جولات (من السجل إن وُجد، وإلا من حالتها الحالية) — دالة صافية */
function roundsOf(review) {
  if (!review) return [];
  const hist = Array.isArray(review.history) ? review.history : [];
  if (hist.length) {
    const out = [];
    let open = null;
    for (const e of hist) {
      if (e.type === 'assigned') { open = { reviewerId: e.reviewerId, reviewerName: e.reviewerName, assignedAt: e.at, round: e.round }; continue; }
      const base = open || { reviewerId: e.reviewerId, reviewerName: e.reviewerName, assignedAt: null, round: e.round };
      out.push({ ...base, decision: e.type, respondedAt: e.at, note: e.note || null, hours: e.hours ?? (base.assignedAt ? (Date.parse(e.at) - Date.parse(base.assignedAt)) / 36e5 : null) });
      open = null;
    }
    if (open) out.push({ ...open, decision: 'pending', respondedAt: null, note: null, hours: null });
    return out;
  }
  // مراجعة قديمة بلا سجل: جولتها الأخيرة وحدها
  return [{
    reviewerId: review.reviewerId, reviewerName: review.reviewerName, assignedAt: review.assignedAt, round: review.rounds || 1,
    decision: review.status === 'ASSIGNED' ? 'pending' : review.status === 'CONFIRMED' ? 'confirmed' : 'returned',
    respondedAt: review.respondedAt || null, note: review.reviewerNote || null,
    hours: review.respondedAt && review.assignedAt ? (Date.parse(review.respondedAt) - Date.parse(review.assignedAt)) / 36e5 : null,
  }];
}

/** مؤشرات المراجعات من جولاتها — دالة صافية */
function summarizeReviews(items, now = new Date()) {
  const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);
  const rounds = [];
  const courses = [];
  for (const it of items) {
    const rs = roundsOf(it.review);
    rs.forEach((r) => rounds.push({ ...r, courseId: it.courseId, courseName: it.courseName, coordinator: it.coordinator }));
    const final = it.review?.status;
    courses.push({ confirmed: final === 'CONFIRMED', firstPass: final === 'CONFIRMED' && rs.filter((x) => x.decision === 'returned').length === 0 });
  }
  const done = rounds.filter((r) => r.decision !== 'pending');
  const hours = done.map((r) => r.hours).filter((h) => Number.isFinite(h));
  const pending = rounds.filter((r) => r.decision === 'pending').map((r) => ({ ...r, waitingHours: r.assignedAt ? r1((now - Date.parse(r.assignedAt)) / 36e5) : null }));
  const confirmedCourses = courses.filter((c) => c.confirmed);
  const byReviewer = new Map();
  for (const r of rounds) {
    const row = byReviewer.get(r.reviewerId) || { reviewerId: r.reviewerId, name: r.reviewerName, reviews: 0, confirmed: 0, returned: 0, pending: 0, hours: [] };
    if (r.decision === 'pending') row.pending += 1;
    else { row.reviews += 1; row[r.decision] += 1; if (Number.isFinite(r.hours)) row.hours.push(r.hours); }
    byReviewer.set(r.reviewerId, row);
  }
  const reviewers = Array.from(byReviewer.values()).map((x) => ({
    ...x, avgHours: x.hours.length ? r1(x.hours.reduce((a, b) => a + b, 0) / x.hours.length) : null, hours: undefined,
  })).sort((a, b) => b.reviews - a.reviews || (a.avgHours ?? 1e9) - (b.avgHours ?? 1e9));
  const byMonth = {};
  for (const r of done) {
    const d = new Date(r.respondedAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth[k] = byMonth[k] || { confirmed: 0, returned: 0 };
    byMonth[k][r.decision] += 1;
  }
  return {
    totals: {
      reviews: done.length,
      confirmed: done.filter((r) => r.decision === 'confirmed').length,
      returned: done.filter((r) => r.decision === 'returned').length,
      pending: pending.length,
      avgHours: hours.length ? r1(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
      within24: hours.length ? Math.round((hours.filter((h) => h <= 24).length / hours.length) * 100) : null,
      courses: courses.length,
      firstPassShare: confirmedCourses.length ? Math.round((confirmedCourses.filter((c) => c.firstPass).length / confirmedCourses.length) * 100) : null,
    },
    reviewers,
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v })),
    notes: rounds.filter((r) => r.note).sort((a, b) => Date.parse(b.respondedAt) - Date.parse(a.respondedAt)).slice(0, 60)
      .map(({ note, decision, reviewerName, courseId, courseName, coordinator, respondedAt }) => ({ note, decision, reviewerName, courseId, courseName, coordinator, respondedAt })),
    pending: pending.sort((a, b) => (b.waitingHours || 0) - (a.waitingHours || 0)).slice(0, 30)
      .map(({ reviewerName, courseId, courseName, coordinator, assignedAt, waitingHours }) => ({ reviewerName, courseId, courseName, coordinator, assignedAt, waitingHours })),
  };
}

async function dashboard() {
  const rows = await prisma.courseClosureTracking.findMany({
    where: { element: { key: ELEMENT_KEY }, formData: { path: ['certReview', 'status'], not: null } },
    select: { formData: true, course: { select: { id: true, name: true, primaryEmployee: { select: { firstName: true, lastName: true } } } } },
  }).catch(() => []);
  const items = rows.filter((r) => r.formData?.certReview).map((r) => ({
    review: r.formData.certReview, courseId: r.course.id, courseName: r.course.name, coordinator: fullName(r.course.primaryEmployee),
  }));
  return summarizeReviews(items);
}

module.exports = { ELEMENT_KEY, isConfirmed, cleanUrl, get, assign, respond, mine, addFile, removeFile, fileForDownload, roundsOf, summarizeReviews, dashboard };
