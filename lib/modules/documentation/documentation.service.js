// =============================================================
// توثيق الدورة — عنصر التميّز
// -------------------------------------------------------------
// اختياري في كل دورة. من وثّق دورته ونشرها بالحد الأدنى من الجودة
// نال «نجمة تميّز» ودرجات إضافية في مؤشره؛ ومن لم يوثّق لا يُخصم
// عليه شيء، ولا يدخل التوثيق في نسبة الإقفال ولا في التأخّر.
//
// والنجمة تُمنح تلقائياً بمعايير ظاهرة (عدد الصور، والغلاف،
// والمقدمة) — لا بانتظار ضغطة مشرف (القاعدة ٣ في وثيقة المنصة).
// وبيانات الدورة لا تُدخل هنا، بل تُقرأ من الدورة نفسها.
// =============================================================
const crypto = require('crypto');
const repo = require('./documentation.repo');
const store = require('../../storage/mediaStore');
const mediaUrl = require('../../storage/mediaUrl');
const permissions = require('../../services/permissions');
const audit = require('../../services/audit');
const configService = require('../config/config.service');

const LIMITS = {
  maxPhotos: 80,
  fullBytes: 4 * 1024 * 1024,
  thumbBytes: 600 * 1024,
  introMax: 3000,
  captionMax: 300,
  maxSessions: 60,
};

// معايير النجمة الافتراضية — تُغيَّر من الإعدادات
const STAR_DEFAULTS = { minPhotos: 8, minIntroChars: 60 };

function httpError(status, message, code) {
  const err = new Error(message);
  err.statusCode = status;
  if (code) err.code = code;
  return err;
}

async function starCriteria() {
  const [minPhotos, minIntroChars] = await Promise.all([
    configService.getSetting('documentation.minPhotos', String(STAR_DEFAULTS.minPhotos)),
    configService.getSetting('documentation.minIntroChars', String(STAR_DEFAULTS.minIntroChars)),
  ]);
  return {
    minPhotos: Math.max(1, Number(minPhotos) || STAR_DEFAULTS.minPhotos),
    minIntroChars: Math.max(0, Number(minIntroChars) || STAR_DEFAULTS.minIntroChars),
  };
}

/** ما تحقق من معايير النجمة وما بقي — يُعرض للمنسق قائمةً واضحة */
function evaluate(doc, criteria) {
  const photos = doc?.media?.length || 0;
  const introChars = String(doc?.intro || '').trim().length;
  const hasCover = !!(doc?.coverMediaId && (doc.media || []).some((m) => m.id === doc.coverMediaId));
  const checks = [
    { key: 'photos', label: `${criteria.minPhotos} صور على الأقل`, done: photos >= criteria.minPhotos, value: photos },
    { key: 'cover', label: 'صورة غلاف مختارة', done: hasCover },
    { key: 'intro', label: `مقدمة تعرّف بالدورة (${criteria.minIntroChars} حرفاً فأكثر)`, done: introChars >= criteria.minIntroChars, value: introChars },
  ];
  return { checks, ready: checks.every((c) => c.done) };
}

async function loadCourse(courseId) {
  const course = await repo.findCourse(courseId);
  if (!course) throw httpError(404, 'الدورة غير موجودة', 'serverErrors.course.notFound');
  return course;
}

async function assertCanView(course, actor) {
  if (!(await permissions.canViewCourse(actor.user, actor.activeRole, course))) {
    throw httpError(403, 'غير مصرح لك بعرض هذه الدورة', 'serverErrors.course.viewForbidden');
  }
}

async function canEdit(course, actor) {
  return (await permissions.canSubmitElement(actor.user, actor.activeRole, course))
    || (await permissions.canDecideElement(actor.user, actor.activeRole, course));
}

async function assertCanEdit(course, actor) {
  if (!(await canEdit(course, actor))) {
    throw httpError(403, 'التوثيق لمنسق الدورة وفريقها ومشرفها', 'serverErrors.documentation.editForbidden');
  }
}

function presentMedia(m, published) {
  const url = published ? mediaUrl.publicUrl : mediaUrl.signedUrl;
  return {
    id: m.id, caption: m.caption, sortOrder: m.sortOrder, width: m.width, height: m.height, size: m.size,
    thumbUrl: url(m.id, 'thumb'), fullUrl: url(m.id, 'full'),
  };
}

function present(course, doc, criteria, editable) {
  const published = doc?.status === 'PUBLISHED';
  return {
    course: {
      id: course.id, name: course.name, city: course.city, startDate: course.startDate, endDate: course.endDate,
      numTrainees: course.numTrainees,
      coordinator: course.primaryEmployee
        ? { id: course.primaryEmployee.id, firstName: course.primaryEmployee.firstName, lastName: course.primaryEmployee.lastName, profileImage: course.primaryEmployee.profileImage }
        : null,
    },
    documentation: doc ? {
      id: doc.id, status: doc.status, slug: published ? doc.slug : null, intro: doc.intro || '', closing: doc.closing || '',
      coverMediaId: doc.coverMediaId, publishedAt: doc.publishedAt, starAwarded: doc.starAwarded, views: doc.views,
      media: (doc.media || []).map((m) => presentMedia(m, published)),
      sessions: (doc.sessions || []).map((s) => ({ id: s.id, title: s.title, presenter: s.presenter, date: s.date, time: s.time, description: s.description })),
    } : null,
    star: evaluate(doc, criteria),
    criteria,
    canEdit: editable,
  };
}

async function get(courseId, actor) {
  const course = await loadCourse(courseId);
  await assertCanView(course, actor);
  const [doc, criteria, editable] = await Promise.all([repo.findByCourse(courseId), starCriteria(), canEdit(course, actor)]);
  return present(course, doc, criteria, editable);
}

// ── الصور ─────────────────────────────────────────────────────
function decodeImage(dataUrl, maxBytes, label) {
  const m = String(dataUrl || '').match(/^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw httpError(400, `صيغة ${label} غير صحيحة`, 'serverErrors.documentation.imageInvalid');
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > maxBytes) throw httpError(400, `حجم ${label} أكبر من المسموح`, 'serverErrors.documentation.imageTooLarge');
  return { buf, ext: m[1] === 'jpeg' ? 'jpg' : m[1] };
}

async function addMedia(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const doc = await repo.ensure(courseId, actor.user.id);
  if ((await repo.countMedia(doc.id)) >= LIMITS.maxPhotos) {
    throw httpError(400, `الحد الأعلى ${LIMITS.maxPhotos} صورة للدورة`, 'serverErrors.documentation.tooManyPhotos');
  }
  const full = decodeImage(dto.full, LIMITS.fullBytes, 'الصورة');
  const thumb = decodeImage(dto.thumb, LIMITS.thumbBytes, 'المصغّرة');
  const width = Math.round(Number(dto.width) || 0);
  const height = Math.round(Number(dto.height) || 0);
  if (width < 50 || height < 50 || width > 6000 || height > 6000) {
    throw httpError(400, 'أبعاد الصورة غير صحيحة', 'serverErrors.documentation.imageInvalid');
  }

  const fileKey = store.newKey(courseId, full.ext);
  const thumbKey = store.newKey(courseId, thumb.ext);
  await store.save(fileKey, full.buf);
  await store.save(thumbKey, thumb.buf);

  const media = await repo.createMedia({
    documentationId: doc.id, fileKey, thumbKey, width, height, size: full.buf.length,
    caption: String(dto.caption || '').trim().slice(0, LIMITS.captionMax) || null,
    sortOrder: await repo.nextSortOrder(doc.id),
    uploadedById: actor.user.id,
  });
  // أول صورة غلافٌ إلى أن يختار المنسق غيرها
  if (!doc.coverMediaId) await repo.update(doc.id, { coverMediaId: media.id });
  return presentMedia(media, doc.status === 'PUBLISHED');
}

async function loadMediaForEdit(mediaId, actor) {
  const media = await repo.findMedia(mediaId);
  if (!media) throw httpError(404, 'الصورة غير موجودة', 'serverErrors.documentation.mediaNotFound');
  const course = await loadCourse(media.documentation.courseId);
  await assertCanEdit(course, actor);
  return media;
}

async function updateMedia(mediaId, dto, actor) {
  const media = await loadMediaForEdit(mediaId, actor);
  if (dto.caption !== undefined) {
    await repo.updateMedia(mediaId, { caption: String(dto.caption || '').trim().slice(0, LIMITS.captionMax) || null });
  }
  if (dto.cover === true) await repo.update(media.documentation.id, { coverMediaId: mediaId });
  return { id: mediaId };
}

async function removeMedia(mediaId, actor) {
  const media = await loadMediaForEdit(mediaId, actor);
  await repo.deleteMedia(mediaId);
  await store.remove(media.fileKey);
  await store.remove(media.thumbKey);
  if (media.documentation.coverMediaId === mediaId) await repo.update(media.documentation.id, { coverMediaId: null });
  return { id: mediaId };
}

// ── المحتوى: المقدمة والخاتمة والترتيب والجلسات ──────────────
function cleanSessions(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, LIMITS.maxSessions)
    .map((s) => ({
      title: String(s?.title || '').trim().slice(0, 200),
      presenter: String(s?.presenter || '').trim().slice(0, 120) || null,
      date: s?.date && !Number.isNaN(Date.parse(s.date)) ? new Date(s.date) : null,
      time: String(s?.time || '').trim().slice(0, 20) || null,
      description: String(s?.description || '').trim().slice(0, 1200) || null,
    }))
    .filter((s) => s.title);
}

async function updateContent(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const doc = await repo.ensure(courseId, actor.user.id);
  const data = {};
  if (dto.intro !== undefined) data.intro = String(dto.intro || '').trim().slice(0, LIMITS.introMax) || null;
  if (dto.closing !== undefined) data.closing = String(dto.closing || '').trim().slice(0, LIMITS.introMax) || null;
  if (Object.keys(data).length) await repo.update(doc.id, data);
  if (Array.isArray(dto.order)) await repo.reorderMedia(doc.id, dto.order.map(String));
  const sessions = cleanSessions(dto.sessions);
  if (sessions) await repo.replaceSessions(doc.id, sessions);

  // التوثيق المنشور إن نقص عن المعايير بعد التعديل تسقط نجمته حتى يُستكمل
  const fresh = await repo.findByCourse(courseId);
  if (fresh.status === 'PUBLISHED' && fresh.starAwarded) {
    const { ready } = evaluate(fresh, await starCriteria());
    if (!ready) await repo.update(fresh.id, { starAwarded: false });
  }
  return get(courseId, actor);
}

// ── النشر والنجمة ─────────────────────────────────────────────
function newSlug() {
  return crypto.randomBytes(10).toString('base64url').replace(/[-_]/g, '').slice(0, 14).toLowerCase()
    + crypto.randomBytes(2).toString('hex');
}

async function publish(courseId, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const doc = await repo.findByCourse(courseId);
  const criteria = await starCriteria();
  const { checks, ready } = evaluate(doc, criteria);
  if (!ready) {
    const missing = checks.filter((c) => !c.done).map((c) => c.label).join('، ');
    throw httpError(400, `أكمل قبل النشر: ${missing}`, 'serverErrors.documentation.notReady');
  }
  const now = new Date();
  await repo.update(doc.id, {
    status: 'PUBLISHED',
    slug: doc.slug || newSlug(),
    publishedAt: doc.publishedAt || now,
    publishedById: actor.user.id,
    starAwarded: true,
    starAwardedAt: doc.starAwardedAt || now,
  });
  await audit.logAudit(actor.user.id, actor.activeRole, 'DOCUMENTATION_PUBLISHED', { courseId, courseName: course.name }, courseId);
  return get(courseId, actor);
}

async function unpublish(courseId, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const doc = await repo.findByCourse(courseId);
  if (!doc) throw httpError(404, 'لا توثيق لهذه الدورة', 'serverErrors.documentation.notFound');
  // الرابط يبقى محفوظاً فيعود كما هو عند إعادة النشر، والنجمة تسقط حتى يُعاد
  await repo.update(doc.id, { status: 'DRAFT', starAwarded: false });
  await audit.logAudit(actor.user.id, actor.activeRole, 'DOCUMENTATION_UNPUBLISHED', { courseId, courseName: course.name }, courseId);
  return get(courseId, actor);
}

// ── عرض الصورة ────────────────────────────────────────────────
/** الصورة تُعرض لكل أحد إن كان التوثيق منشوراً، وإلا فبرابط موقَّع */
async function mediaForDisplay(mediaId, size, query) {
  const media = await repo.findMedia(mediaId);
  if (!media) throw httpError(404, 'الصورة غير موجودة');
  const s = size === 'full' ? 'full' : 'thumb';
  const allowed = media.documentation.status === 'PUBLISHED' || mediaUrl.verify(mediaId, s, query.e, query.t);
  if (!allowed) throw httpError(403, 'الرابط منتهي أو غير صالح');
  const key = s === 'full' ? media.fileKey : media.thumbKey;
  const ext = key.split('.').pop();
  return { key, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}`, published: media.documentation.status === 'PUBLISHED' };
}

module.exports = {
  LIMITS, STAR_DEFAULTS, evaluate, starCriteria,
  get, addMedia, updateMedia, removeMedia, updateContent, publish, unpublish, mediaForDisplay,
};
