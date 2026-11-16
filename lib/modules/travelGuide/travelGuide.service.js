// ======================================================================
// عنصر «دليل السفر التعريفي» — إلزامي لكل دورة
// ----------------------------------------------------------------------
// إجراءان:
//   ١. تقديم الدليل: رابط الدليل من منصة أدلة السفر (أو غيرها) ثم التقديم للاعتماد.
//   ٢. لا يوجد دليل لمدينة التنفيذ: يُخرج المنسق رسالة لمدير الإدارة يطلب
//      تصميم دليل جديد باسم المدينة، ويرفق بها ملفاً بالمعلومات المراد
//      إدراجها. وإن تأخر الدليل رفع بلاغ عائق كأي عنصر آخر.
// ولا يُقدَّم العنصر للاعتماد إلا برابط الدليل (يتحقق منه الخادم عند التقديم).
// ======================================================================
const repo = require('../closure/closure.repo');
const permissions = require('../../services/permissions');
const configService = require('../config/config.service');
const prisma = require('../../db/prisma');
const { buildEmlMessage } = require('../../email/eml');
const { emailShell, infoTable, coordinatorOf, gregorian } = require('../../reports/interpreterDocs');

const ELEMENT_KEY = 'travel_guide';
const PLANNER_URL = 'https://nauss-journey-planner.lovable.app/';
const MAIL_DEFAULTS = {
  'travelGuide.request.email.to': 'OD@nauss.edu.sa',
  'travelGuide.request.email.cc': 'NAlshahrani@nauss.edu.sa',
};
const MODES = ['existing', 'request'];

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);

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

/** بيانات العنصر كما يحفظها المنسق؛ ما لا يخص الإجراء المختار يُهمل */
function cleanGuide(dto, previous = {}) {
  const d = dto && typeof dto === 'object' ? dto : {};
  const mode = MODES.includes(d.mode) ? d.mode : 'existing';
  return {
    mode,
    url: cleanUrl(d.url),
    city: str(d.city, 120),
    note: str(d.note, 1000), // للطلب: ما يُراد إدراجه في الدليل أو ملاحظة عامة
    requestedAt: previous.requestedAt || null, // يُسجَّل عند إخراج رسالة الطلب
  };
}

async function loadForEdit(trackingId, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);
  if (!item) throw httpError(404, 'العنصر غير موجود', 'serverErrors.closureElements.notFound');
  if (item.element.key !== ELEMENT_KEY) throw httpError(400, 'هذا العنصر ليس دليل السفر', 'serverErrors.travelGuide.notGuideElement');
  const allowed = await permissions.canViewCourse(user, activeRole, item.course);
  if (!allowed) throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  return item;
}

async function get(trackingId, user, activeRole) {
  const item = await loadForEdit(trackingId, user, activeRole);
  const canEdit = await permissions.canSubmitElement(user, activeRole, item.course);
  return {
    guide: item.formData?.travelGuide || null,
    course: { name: item.course.name, city: item.course.city, startDate: item.course.startDate, endDate: item.course.endDate },
    plannerUrl: PLANNER_URL,
    canEdit,
  };
}

async function save(trackingId, dto, user, activeRole) {
  const item = await loadForEdit(trackingId, user, activeRole);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }
  if (['APPROVED', 'PENDING_APPROVAL'].includes(item.status)) {
    throw httpError(400, 'العنصر مُقدَّم — لا يُعدَّل', 'serverErrors.travelGuide.locked');
  }
  if (dto?.url && !cleanUrl(dto.url)) throw httpError(400, 'رابط الدليل غير صالح — يبدأ بـ https://', 'serverErrors.travelGuide.badUrl');
  const guide = cleanGuide(dto, item.formData?.travelGuide || {});
  if (!guide.city) guide.city = item.course.city || '';
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), travelGuide: guide } },
  });
  return { guide };
}

function renderRequestEmail(course, guide) {
  const city = guide.city || course.city;
  return emailShell({
    salutation: 'سعادة مدير الإدارة',
    coordinator: coordinatorOf(course),
    paragraphs: [
      `تنفّذ وكالة الجامعة للتدريب البرنامج التدريبي <strong>«${esc(course.name)}»</strong> في
       <strong>${esc(city)}</strong> خلال الفترة من ${gregorian(course.startDate)} إلى ${gregorian(course.endDate)}،
       ولا يتوفر في منصة أدلة السفر دليل تعريفي لهذه المدينة.`,
      `وآمل التكرّم بالتوجيه بتصميم <strong>دليل سفر تعريفي باسم «${esc(city)}»</strong> يُزوَّد به المشاركون قبل سفرهم،
       ومرفق بالرسالة ملف يتضمن المعلومات المراد إدراجها في الدليل.`,
      guide.note ? `ملاحظات المنسق: ${esc(guide.note)}` : '',
    ].filter(Boolean),
    tables: [infoTable([
      ['البرنامج التدريبي', course.name],
      ['مدينة التنفيذ', city],
      ['بداية البرنامج', gregorian(course.startDate)],
      ['نهاية البرنامج', gregorian(course.endDate)],
      ['منصة أدلة السفر', PLANNER_URL],
    ])],
  });
}

const setting = (key) => configService.getSetting(key, MAIL_DEFAULTS[key]);

/** رسالة طلب تصميم دليل جديد (EML) ويُسجَّل وقت إخراجها */
async function requestEmail(trackingId, user, activeRole) {
  const item = await loadForEdit(trackingId, user, activeRole);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }
  const course = await prisma.course.findUnique({
    where: { id: item.courseId },
    select: { name: true, city: true, startDate: true, endDate: true, primaryEmployee: { select: { firstName: true, lastName: true } } },
  });
  const previous = item.formData?.travelGuide || {};
  const guide = { ...cleanGuide({ ...previous, mode: 'request' }, previous), city: previous.city || course.city || '' };
  const [to, cc] = await Promise.all([setting('travelGuide.request.email.to'), setting('travelGuide.request.email.cc')]);
  const eml = buildEmlMessage({ to, cc, subject: `طلب تصميم دليل سفر تعريفي — ${guide.city} — ${course.name}`, htmlBody: renderRequestEmail(course, guide) });
  guide.requestedAt = new Date().toISOString();
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), travelGuide: guide } },
  });
  return { eml, courseName: course.name };
}

module.exports = { ELEMENT_KEY, PLANNER_URL, MAIL_DEFAULTS, cleanUrl, cleanGuide, get, save, requestEmail, renderRequestEmail };
