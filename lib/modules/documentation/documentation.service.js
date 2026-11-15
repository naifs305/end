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
const { cleanEdit } = require('../../documentation/photoLook');
const { cleanSections } = require('../../documentation/sections');
const ai = require('./documentation.ai');
const { parseLmsSchedule } = require('../../documentation/lmsSchedule');

const LIMITS = {
  maxPhotos: 80,
  fullBytes: 4 * 1024 * 1024,
  thumbBytes: 600 * 1024,
  introMax: 3000,
  captionMax: 300,
  maxSessions: 60,
  maxTrainees: 200,
  traineePhotoBytes: 400 * 1024,
  textMax: 4000,
  sessionPhotos: 4,
};

const FORMATS = ['A4', 'SQUARE'];
// شعارات الشركاء الجاهزة (شعار الجامعة ثابت لا يُختار)
const LOGO_PRESETS = {
  'moi-partnerships': { name: 'برامج الشراكات الدولية — وزارة الداخلية', url: '/brand/moi-partnerships.png' },
};
const LOGO_KEY_RE = /^[A-Za-z0-9_-]{1,61}-l\/[A-Za-z0-9_-]{8,64}\.(webp|jpg|png)$/;
const logoUrl = (key) => `/api/documentation/logo?k=${encodeURIComponent(key)}`;

function presentLogos(list) {
  return (Array.isArray(list) ? list : []).map((l) => {
    if (l?.preset && LOGO_PRESETS[l.preset]) return { preset: l.preset, name: LOGO_PRESETS[l.preset].name, url: LOGO_PRESETS[l.preset].url };
    if (l?.key && LOGO_KEY_RE.test(l.key)) return { key: l.key, name: l.name || '', url: logoUrl(l.key) };
    return null;
  }).filter(Boolean);
}

function cleanLogos(list, courseId) {
  if (!Array.isArray(list)) return undefined;
  const seen = new Set();
  return list.map((l) => {
    if (l?.preset && LOGO_PRESETS[l.preset]) return { preset: l.preset };
    const key = String(l?.key || '');
    if (LOGO_KEY_RE.test(key) && key.startsWith(`${courseId}-l/`)) return { key, name: String(l.name || '').slice(0, 60) };
    return null;
  }).filter((l) => l && !seen.has(l.preset || l.key) && seen.add(l.preset || l.key)).slice(0, 5);
}

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

const withV = (u, key) => (key ? `${u}${u.includes('?') ? '&' : '?'}v=${String(key).split('/').pop().slice(0, 10)}` : u);

function presentMedia(m, published) {
  const url = published ? mediaUrl.publicUrl : mediaUrl.signedUrl;
  return {
    id: m.id, caption: m.caption, sortOrder: m.sortOrder, width: m.width, height: m.height, size: m.size,
    edit: m.edit || null,
    // ‎v‎ يتغيّر بتغيّر الملف (بعد الضغط أو التدوير) فلا تُعرض نسخة قديمة محفوظة في المتصفح
    thumbUrl: withV(url(m.id, 'thumb'), m.thumbKey), fullUrl: withV(url(m.id, 'full'), m.fileKey),
  };
}

function presentCourse(course, { withSignature = false } = {}) {
  const pe = course.primaryEmployee;
  return {
    id: course.id, name: course.name, city: course.city, startDate: course.startDate, endDate: course.endDate,
    numTrainees: course.numTrainees,
    coordinator: pe ? {
      id: pe.id, firstName: pe.firstName, lastName: pe.lastName, profileImage: pe.profileImage,
      ...(withSignature ? { signatureImage: pe.signatureImage || null } : {}),
    } : null,
  };
}

const presentSession = (s) => ({
  id: s.id, title: s.title, presenter: s.presenter, date: s.date, time: s.time, description: s.description,
  photoIds: Array.isArray(s.photoIds) ? s.photoIds : [],
});

function presentTrainee(t) {
  return {
    id: t.id, name: t.name, entity: t.entity, score: t.score, distinction: t.distinction,
    isDistinguished: t.isDistinguished, photoKey: t.photoKey,
    photoUrl: t.photoKey ? mediaUrl.signedKeyUrl(t.photoKey) : null,
  };
}

function present(course, doc, criteria, editable) {
  const published = doc?.status === 'PUBLISHED';
  return {
    course: presentCourse(course, { withSignature: true }),
    documentation: doc ? {
      id: doc.id, status: doc.status, slug: published ? doc.slug : null, intro: doc.intro || '', closing: doc.closing || '',
      coverMediaId: doc.coverMediaId, publishedAt: doc.publishedAt, starAwarded: doc.starAwarded, views: doc.views,
      format: doc.format || 'A4',
      welcome: doc.welcome || '', patronage: doc.patronage || '', logos: presentLogos(doc.logos),
      featured: !!doc.featured, sections: doc.sections || {},
      reportSummary: doc.reportSummary || '', recommendations: doc.recommendations || '',
      media: (doc.media || []).map((m) => presentMedia(m, published)),
      sessions: (doc.sessions || []).map(presentSession),
      trainees: (doc.trainees || []).map(presentTrainee),
    } : null,
    star: evaluate(doc, criteria),
    criteria,
    canEdit: editable,
    aiEnabled: editable && ai.isConfigured(),
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
  // موضع التركيز والتقريب والفلتر — أرقام تُطبَّق عند العرض، والأصل لا يُمسّ
  if (dto.edit !== undefined) await repo.updateMedia(mediaId, { edit: dto.edit === null ? null : cleanEdit(dto.edit) });
  // تدوير الصورة: يُرسل المتصفح نسخة مدوَّرة بأعلى جودة فتحلّ محل القديمة
  if (dto.replace) {
    const full = decodeImage(dto.replace.full, LIMITS.fullBytes, 'الصورة');
    const thumb = decodeImage(dto.replace.thumb, LIMITS.thumbBytes, 'المصغّرة');
    const courseId = media.documentation.courseId;
    const fileKey = store.newKey(courseId, full.ext);
    const thumbKey = store.newKey(courseId, thumb.ext);
    await store.save(fileKey, full.buf);
    await store.save(thumbKey, thumb.buf);
    await repo.updateMedia(mediaId, {
      fileKey, thumbKey, size: full.buf.length,
      width: Math.max(1, Math.min(10000, Number(dto.replace.width) || media.width)),
      height: Math.max(1, Math.min(10000, Number(dto.replace.height) || media.height)),
    });
    await store.remove(media.fileKey);
    await store.remove(media.thumbKey);
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
      photoIds: [...new Set((Array.isArray(s?.photoIds) ? s.photoIds : []).map(String).filter((x) => /^[\w-]{1,64}$/.test(x)))].slice(0, LIMITS.sessionPhotos),
    }))
    .filter((s) => s.title);
}

function cleanTrainees(list) {
  if (!Array.isArray(list)) return null;
  return list.slice(0, LIMITS.maxTrainees)
    .map((t) => {
      const raw = t?.score === '' || t?.score === null || t?.score === undefined ? null : Number(String(t.score).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
      return {
        name: String(t?.name || '').trim().slice(0, 160),
        entity: String(t?.entity || '').trim().slice(0, 160) || null,
        score: raw === null || !Number.isFinite(raw) ? null : Math.max(0, Math.min(100, raw)),
        distinction: String(t?.distinction || '').trim().slice(0, 600) || null,
        isDistinguished: !!t?.isDistinguished,
        photoKey: t?.photoKey && store.KEY_RE.test(String(t.photoKey)) ? String(t.photoKey) : null,
      };
    })
    .filter((t) => t.name);
}

async function updateContent(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const doc = await repo.ensure(courseId, actor.user.id);
  const data = {};
  if (dto.intro !== undefined) data.intro = String(dto.intro || '').trim().slice(0, LIMITS.introMax) || null;
  if (dto.closing !== undefined) data.closing = String(dto.closing || '').trim().slice(0, LIMITS.introMax) || null;
  if (dto.reportSummary !== undefined) data.reportSummary = String(dto.reportSummary || '').trim().slice(0, LIMITS.textMax) || null;
  if (dto.recommendations !== undefined) data.recommendations = String(dto.recommendations || '').trim().slice(0, LIMITS.textMax) || null;
  if (dto.format !== undefined && FORMATS.includes(dto.format)) data.format = dto.format;
  if (dto.welcome !== undefined) data.welcome = String(dto.welcome || '').trim().slice(0, 1500) || null;
  if (dto.patronage !== undefined) data.patronage = String(dto.patronage || '').trim().slice(0, 160) || null;
  const logos = cleanLogos(dto.logos, courseId);
  if (logos !== undefined) data.logos = logos;
  const sections = cleanSections(dto.sections);
  if (sections !== undefined) data.sections = sections;
  if (Object.keys(data).length) await repo.update(doc.id, data);
  if (Array.isArray(dto.order)) await repo.reorderMedia(doc.id, dto.order.map(String));
  const sessions = cleanSessions(dto.sessions);
  if (sessions) {
    // صور الجلسة لا تكون إلا من صور هذا التوثيق نفسه
    const own = new Set(((await repo.findByCourse(courseId))?.media || []).map((m) => m.id));
    for (const x of sessions) x.photoIds = x.photoIds.filter((pid) => own.has(pid));
    await repo.replaceSessions(doc.id, sessions);
  }
  const trainees = cleanTrainees(dto.trainees);
  if (trainees) {
    // صورة متدرب لم تعد في القائمة تُحذف من المخزن
    const before = await repo.findByCourse(courseId);
    const kept = new Set(trainees.map((t) => t.photoKey).filter(Boolean));
    for (const t of before?.trainees || []) if (t.photoKey && !kept.has(t.photoKey)) await store.remove(t.photoKey);
    await repo.replaceTrainees(doc.id, trainees);
  }

  // التوثيق المنشور إن نقص عن المعايير بعد التعديل تسقط نجمته حتى يُستكمل
  const fresh = await repo.findByCourse(courseId);
  if (fresh.status === 'PUBLISHED' && fresh.starAwarded) {
    const { ready } = evaluate(fresh, await starCriteria());
    if (!ready) await repo.update(fresh.id, { starAwarded: false });
  }
  return get(courseId, actor);
}

// ── شعار شريك: يُرفع PNG شفافاً، ويُعرض عاماً (مفتاحه عشوائي لا يُخمَّن) ──
async function addLogo(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const img = decodeImage(dto.image, 1024 * 1024, 'الشعار');
  const key = store.newKey(`${courseId}-l`, img.ext);
  await store.save(key, img.buf);
  return { key, url: logoUrl(key) };
}

function logoForDisplay(key) {
  if (!LOGO_KEY_RE.test(String(key || ''))) throw httpError(404, 'غير موجود');
  const ext = key.split('.').pop();
  return { key, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
}

// ── مكتبة الإصدارات: كل المجلات المنشورة لكل المستخدمين ──
async function library({ featuredOnly = false, q = '' } = {}) {
  const rows = await repo.findLibrary({ featuredOnly, q: String(q || '').trim().slice(0, 80) });
  return rows.map((d) => {
    const cover = (d.media || []).find((m) => m.id === d.coverMediaId) || (d.media || [])[0] || null;
    const pe = d.course?.primaryEmployee;
    return {
      slug: d.slug, featured: !!d.featured, featuredAt: d.featuredAt, publishedAt: d.publishedAt, views: d.views, format: d.format || 'A4',
      courseId: d.courseId, courseName: d.course?.name, city: d.course?.city, startDate: d.course?.startDate, endDate: d.course?.endDate,
      coordinator: pe ? { id: pe.id, firstName: pe.firstName, lastName: pe.lastName, profileImage: pe.profileImage } : null,
      cover: cover ? { id: cover.id, width: cover.width, height: cover.height, edit: cover.edit || null, thumbUrl: withV(mediaUrl.publicUrl(cover.id, 'thumb'), cover.thumbKey), fullUrl: withV(mediaUrl.publicUrl(cover.id, 'full'), cover.fileKey) } : null,
      photos: (d._count?.media) ?? (d.media || []).length,
    };
  });
}

/** «إصدار مميّز»: يمنحه المدير وحده لتوثيق منشور، فيتصدّر المكتبة ويُعلن في الشريط */
async function setFeatured(courseId, on, actor) {
  if (actor.activeRole !== 'MANAGER') throw httpError(403, 'تمييز الإصدارات للمدير وحده', 'serverErrors.documentation.featureForbidden');
  const doc = await repo.findByCourse(courseId);
  if (!doc || doc.status !== 'PUBLISHED') throw httpError(400, 'لا يُميَّز إلا توثيق منشور', 'serverErrors.documentation.featureUnpublished');
  await repo.update(doc.id, on ? { featured: true, featuredAt: new Date() } : { featured: false, featuredAt: null });
  await audit.logAudit(actor.user.id, actor.activeRole, on ? 'DOCUMENTATION_FEATURED' : 'DOCUMENTATION_UNFEATURED', { documentationId: doc.id }, courseId);
  return { featured: !!on };
}

// ── المساعد: لصق الجدول، وأوصاف الجلسات، وتقرير الجهة المنفّذة ─
// لا يحفظ شيئاً بنفسه: يعيد اقتراحاً يراجعه المنسق ثم يحفظه.
async function assist(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  const action = dto?.action;

  if (action === 'schedule') {
    const text = String(dto.text || '').slice(0, 60000);
    if (!text.trim()) throw httpError(400, 'الصق نص الجدول أولاً', 'serverErrors.documentation.emptyPaste');
    // القواعد أولاً (دقيقة وبلا تكلفة)، والمساعد احتياطاً لصيغة غير مألوفة
    let sessions = parseLmsSchedule(text);
    let via = 'rules';
    if (!sessions.length && ai.isConfigured()) { sessions = await ai.readSchedule({ text }); via = 'ai'; }
    return { sessions: sessions.slice(0, LIMITS.maxSessions), via };
  }

  if (action === 'describe') {
    const sessions = (Array.isArray(dto.sessions) ? dto.sessions : []).slice(0, LIMITS.maxSessions).map((s) => ({
      title: String(s?.title || '').slice(0, 200), presenter: String(s?.presenter || '').slice(0, 120),
      date: s?.date || null, description: String(s?.description || '').slice(0, 1200),
    }));
    const indexes = (Array.isArray(dto.indexes) ? dto.indexes : []).map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < sessions.length).slice(0, 30);
    if (!indexes.length) throw httpError(400, 'لا جلسات بعناوين لكتابة أوصافها', 'serverErrors.documentation.noSessions');
    const descriptions = await ai.describeSessions({ course, intro: String(dto.intro || ''), sessions, indexes });
    return { descriptions };
  }

  if (action === 'compose') {
    const field = String(dto.field || '');
    const list = (Array.isArray(dto.sessions) ? dto.sessions : []).slice(0, LIMITS.maxSessions).map((x) => ({
      title: String(x?.title || '').slice(0, 200), presenter: String(x?.presenter || '').slice(0, 120),
      date: x?.date || null, description: String(x?.description || '').slice(0, 1200),
    }));
    const scores = (Array.isArray(dto.trainees) ? dto.trainees : []).map((t) => Number(t?.score)).filter((n) => Number.isFinite(n));
    const traineeFacts = {
      count: Array.isArray(dto.trainees) ? dto.trainees.length : 0,
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      top: scores.length ? Math.max(...scores) : null,
      passRate: scores.length ? Math.round((scores.filter((n) => n >= 60).length / scores.length) * 100) : null,
      entities: [...new Set((dto.trainees || []).map((t) => String(t?.entity || '').trim()).filter(Boolean))].slice(0, 20),
      distinctions: (dto.trainees || []).filter((t) => t?.isDistinguished && t?.distinction).map((t) => String(t.distinction).slice(0, 200)).slice(0, 6),
    };
    const text = await ai.composeText({
      field, course,
      texts: { intro: String(dto.intro || ''), closing: String(dto.closing || ''), welcome: String(dto.welcome || ''), patronage: String(dto.patronage || ''), reportSummary: String(dto.reportSummary || ''), recommendations: String(dto.recommendations || '') },
      sessions: list, trainees: traineeFacts,
    });
    return { text };
  }

  if (action === 'report') {
    const m = String(dto.pdf || '').match(/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw httpError(400, 'أرفق التقرير بصيغة PDF', 'serverErrors.documentation.pdfInvalid');
    if (Buffer.byteLength(m[1], 'base64') > 15 * 1024 * 1024) throw httpError(400, 'حجم التقرير أكبر من ١٥ ميجابايت', 'serverErrors.documentation.pdfTooLarge');
    return ai.readProviderReport({ course, pdfBase64: m[1] });
  }

  throw httpError(400, 'طلب غير معروف', 'serverErrors.documentation.badAction');
}

// ── صورة متدرب (للتقرير الفني — داخلية لا تُنشر) ─────────────
async function addTraineePhoto(courseId, dto, actor) {
  const course = await loadCourse(courseId);
  await assertCanEdit(course, actor);
  await repo.ensure(courseId, actor.user.id);
  const img = decodeImage(dto.photo, LIMITS.traineePhotoBytes, 'صورة المتدرب');
  const key = store.newKey(`${courseId}-t`, img.ext);
  await store.save(key, img.buf);
  return { photoKey: key, photoUrl: mediaUrl.signedKeyUrl(key) };
}

async function traineeFileForDisplay(query) {
  const key = String(query.k || '');
  if (!store.KEY_RE.test(key) || !mediaUrl.verifyKey(key, query.e, query.t)) throw httpError(403, 'الرابط منتهي أو غير صالح');
  const ext = key.split('.').pop();
  return { key, contentType: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` };
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

// ── المجلة العامة: لمن يملك الرابط، بلا متدربين ولا درجات ────
async function getPublic(slug, { countView = false } = {}) {
  if (!/^[a-z0-9]{8,40}$/.test(String(slug || ''))) return null;
  const doc = await repo.findBySlug(slug);
  if (!doc || doc.status !== 'PUBLISHED') return null;
  if (countView) await repo.incrementViews(doc.id);
  return {
    course: presentCourse(doc.course),
    documentation: {
      id: doc.id, slug: doc.slug, intro: doc.intro || '', closing: doc.closing || '', coverMediaId: doc.coverMediaId,
      format: doc.format || 'A4',
      welcome: doc.welcome || '', patronage: doc.patronage || '', logos: presentLogos(doc.logos), featured: !!doc.featured,
      sections: doc.sections || {},
      publishedAt: doc.publishedAt, starAwarded: doc.starAwarded, views: doc.views,
      media: (doc.media || []).map((m) => presentMedia(m, true)),
      sessions: (doc.sessions || []).map(presentSession),
    },
  };
}

/** أخبار المجلات المنشورة حديثاً — لشريط الأخبار */
async function tickerItems(now = new Date()) {
  const since = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const rows = await repo.findRecentPublished(since);
  return rows.map((r) => {
    const who = `${r.course?.primaryEmployee?.firstName || ''} ${r.course?.primaryEmployee?.lastName || ''}`.trim();
    const featured = r.featured && r.featuredAt && new Date(r.featuredAt) >= since;
    return {
      id: `magazine-${r.slug}${featured ? '-featured' : ''}`,
      icon: '★',
      tone: featured ? 'amber' : 'primary',
      text: featured
        ? `إصدار مميّز: مجلة دورة «${r.course?.name || ''}» بإعداد ${who} — اختارها المدير ضمن أفضل الإصدارات`
        : `صدرت مجلة توثيق دورة «${r.course?.name || ''}» بإعداد ${who} — تصفّحها`,
      href: `/m/${r.slug}`,
    };
  });
}

async function publishedSlug(courseId) {
  return (await repo.findPublishedSlug(courseId))?.slug || null;
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
  LIMITS, STAR_DEFAULTS, evaluate, starCriteria, assist, addLogo, logoForDisplay, library, setFeatured,
  get, addMedia, updateMedia, removeMedia, updateContent, publish, unpublish, mediaForDisplay,
  addTraineePhoto, traineeFileForDisplay, getPublic, tickerItems, publishedSlug, cleanTrainees,
};
