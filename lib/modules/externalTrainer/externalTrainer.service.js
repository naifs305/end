// ======================================================================
// عنصر «مدرب خارجي» — اختياري يفعّله المنسق حين يكون مدرب الدورة من خارج المملكة
// ----------------------------------------------------------------------
// يجمع بيانات المدرب مرة واحدة، ثم يُخرج ثلاث رسائل بريد جاهزة بصياغة
// مؤسسية (EML) يرسلها المنسق بنفسه:
//   ١. الموارد البشرية: إصدار تذاكر السفر.
//   ٢. المراسم: الاستقبال والتوديع وفق التذاكر المصدرة.
//   ٣. الضيافة والإسكان: الإقامة مدة البرنامج، قبله بيوم وبعده بيوم.
// والمرفقات (موافقة المعالي، والجواز، والتأشيرة، والتذكرة) يرفقها المنسق،
// وتذكّره المنصة بها قبل كل تنزيل.
// ======================================================================
const repo = require('../closure/closure.repo');
const permissions = require('../../services/permissions');
const configService = require('../config/config.service');
const prisma = require('../../db/prisma');
const { buildEmlMessage } = require('../../email/eml');
const { emailShell, infoTable, coordinatorOf, gregorian } = require('../../reports/interpreterDocs');

const ELEMENT_KEY = 'external_trainer';

const MAIL_DEFAULTS = {
  'trainer.hr.email.to': 'hr@nauss.edu.sa',
  'trainer.hr.email.cc': 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlgunian@nauss.edu.sa',
  'trainer.protocol.email.to': 'PRM@nauss.edu.sa',
  'trainer.protocol.email.cc': 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlshehri6@nauss.edu.sa',
  'trainer.hospitality.email.to': 'Hospitality@nauss.edu.sa',
  'trainer.hospitality.email.cc': 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, SKAlanazi@nauss.edu.sa',
};

const OUTPUTS = ['hr', 'protocol', 'hospitality'];
const CLASSES = ['ضيافة', 'أعمال', 'أولى'];

function httpError(status, message, code) {
  const e = new Error(message);
  e.statusCode = status;
  e.code = code;
  return e;
}

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const dateOrEmpty = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const timeOrEmpty = (v) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : '');

function cleanFlight(f) {
  const x = f && typeof f === 'object' ? f : {};
  return {
    date: dateOrEmpty(x.date), time: timeOrEmpty(x.time),
    flightNo: str(x.flightNo, 20), airline: str(x.airline, 80),
    city: str(x.city, 80), // المدينة القادم منها (الوصول) أو المسافر إليها (المغادرة)
  };
}

/** تنظيف بيانات المدرب كما تصل من النموذج */
function cleanTrainer(dto) {
  const d = dto && typeof dto === 'object' ? dto : {};
  return {
    nameAr: str(d.nameAr, 160),
    nameEn: str(d.nameEn, 160), // كما في جواز السفر — لإصدار التذاكر
    title: str(d.title, 160), // الصفة أو الجهة
    nationality: str(d.nationality, 80),
    passportNo: str(d.passportNo, 30),
    passportExpiry: dateOrEmpty(d.passportExpiry),
    mobile: str(d.mobile, 40),
    email: str(d.email, 120),
    departureCity: str(d.departureCity, 120), // مدينة السفر منها وإليها
    travelOut: dateOrEmpty(d.travelOut), // التاريخ المقترح للقدوم
    travelBack: dateOrEmpty(d.travelBack), // التاريخ المقترح للعودة
    ticketClass: CLASSES.includes(d.ticketClass) ? d.ticketClass : 'ضيافة',
    notes: str(d.notes, 600),
    arrival: cleanFlight(d.arrival), // من التذكرة المصدرة
    departure: cleanFlight(d.departure),
  };
}

const hasTicket = (t) => !!(t?.arrival?.date && t?.departure?.date);

async function loadForEdit(trackingId, user, activeRole) {
  const item = await repo.findTrackingWithElementAndCourse(trackingId);
  if (!item) throw httpError(404, 'العنصر غير موجود', 'serverErrors.closureElements.notFound');
  if (item.element.key !== ELEMENT_KEY) throw httpError(400, 'هذا العنصر ليس عنصر المدرب الخارجي', 'serverErrors.trainer.notTrainerElement');
  const allowed = await permissions.canViewCourse(user, activeRole, item.course);
  if (!allowed) throw httpError(403, 'غير مصرح', 'serverErrors.common.forbidden');
  return item;
}

async function get(trackingId, user, activeRole) {
  const item = await loadForEdit(trackingId, user, activeRole);
  const canEdit = await permissions.canSubmitElement(user, activeRole, item.course);
  return {
    trainer: item.formData?.trainer || null,
    sent: item.formData?.trainerMailSent || {},
    course: { name: item.course.name, city: item.course.city, startDate: item.course.startDate, endDate: item.course.endDate },
    canEdit,
  };
}

async function save(trackingId, dto, user, activeRole) {
  const item = await loadForEdit(trackingId, user, activeRole);
  if (!(await permissions.canSubmitElement(user, activeRole, item.course))) {
    throw httpError(403, 'لا تملك صلاحية تنفيذ هذا العنصر', 'serverErrors.closure.submitForbidden');
  }
  if (['APPROVED', 'PENDING_APPROVAL'].includes(item.status)) {
    throw httpError(400, 'العنصر مُقدَّم — لا يُعدَّل', 'serverErrors.trainer.locked');
  }
  const trainer = cleanTrainer(dto);
  if (!trainer.nameAr && !trainer.nameEn) throw httpError(400, 'أدخل اسم المدرب', 'serverErrors.trainer.nameRequired');
  await prisma.courseClosureTracking.update({
    where: { id: trackingId },
    data: { formData: { ...(item.formData || {}), trainer } },
  });
  return { trainer };
}

// ── الرسائل ──────────────────────────────────────────────────
const day = 24 * 60 * 60 * 1000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

function stayDates(course, t) {
  // الإقامة: من يوم الوصول (أو قبل البرنامج بيوم) إلى يوم المغادرة (أو بعده بيوم)
  const from = t.arrival?.date || iso(new Date(course.startDate).getTime() - day);
  const to = t.departure?.date || iso(new Date(course.endDate).getTime() + day);
  const nights = Math.max(1, Math.round((new Date(to) - new Date(from)) / day));
  return { from, to, nights };
}

const flightText = (f) => [f.date ? gregorian(f.date) : '', f.time ? `الساعة ${f.time}` : '', f.airline, f.flightNo ? `رحلة ${f.flightNo}` : '']
  .filter(Boolean).join(' — ');

function trainerRows(t) {
  return [
    ['اسم المدرب', t.nameAr],
    ['الاسم كما في جواز السفر', t.nameEn],
    ['الصفة أو الجهة', t.title],
    ['الجنسية', t.nationality],
    ['رقم جواز السفر', t.passportNo],
    ['انتهاء الجواز', t.passportExpiry ? gregorian(t.passportExpiry) : ''],
    ['الجوال', t.mobile],
    ['البريد الإلكتروني', t.email],
  ];
}

function programRows(course) {
  return [
    ['البرنامج التدريبي', course.name],
    ['مقر التنفيذ', course.city],
    ['فترة التنفيذ', `${gregorian(course.startDate)} — ${gregorian(course.endDate)}`],
  ];
}

function renderHrEmail(course, t) {
  return emailShell({
    salutation: 'سعادة مدير إدارة الموارد البشرية',
    coordinator: coordinatorOf(course),
    paragraphs: [
      `تنفّذ وكالة الجامعة للتدريب البرنامج التدريبي <strong>«${esc(course.name)}»</strong>،
       ويقدّمه المدرب <strong>${esc(t.nameAr || t.nameEn)}</strong> من خارج المملكة.`,
      `آمل التكرّم بالتوجيه بإصدار تذاكر سفر المدرب ذهاباً وعودة على
       <strong>درجة ${esc(t.ticketClass)}</strong>، وفق البيانات أدناه، مرفقاً بالرسالة موافقة معالي الرئيس،
       وصورة جواز سفر المدرب وتأشيرته.`,
    ],
    tables: [
      infoTable(programRows(course)),
      infoTable([
        ...trainerRows(t),
        ['مدينة السفر منها وإليها', t.departureCity],
        ['التاريخ المقترح للقدوم', t.travelOut ? gregorian(t.travelOut) : ''],
        ['التاريخ المقترح للعودة', t.travelBack ? gregorian(t.travelBack) : ''],
        ['ملاحظات', t.notes],
      ]),
    ],
  });
}

function renderProtocolEmail(course, t) {
  return emailShell({
    salutation: 'سعادة مدير إدارة المراسم',
    coordinator: coordinatorOf(course),
    paragraphs: [
      `يسعد وكالة الجامعة للتدريب أن تستضيف المدرب <strong>${esc(t.nameAr || t.nameEn)}</strong>
       لتقديم البرنامج التدريبي <strong>«${esc(course.name)}»</strong>.`,
      `وآمل التكرّم بالتوجيه باستقباله عند وصوله، وتوديعه عند مغادرته، بما يليق بضيوف الجامعة،
       وفق مواعيد رحلتيه الموضحة أدناه حسب التذكرة المصدرة له.`,
    ],
    tables: [
      infoTable(programRows(course)),
      infoTable([
        ['اسم الضيف', t.nameAr || t.nameEn],
        ['الاسم كما في جواز السفر', t.nameEn],
        ['الصفة أو الجهة', t.title],
        ['الجنسية', t.nationality],
        ['الجوال', t.mobile],
      ]),
      infoTable([
        ['الوصول', flightText(t.arrival)],
        ['قادماً من', t.arrival.city],
        ['المغادرة', flightText(t.departure)],
        ['متوجهاً إلى', t.departure.city],
      ]),
    ],
  });
}

function renderHospitalityEmail(course, t) {
  const stay = stayDates(course, t);
  return emailShell({
    salutation: 'سعادة مدير إدارة الضيافة والإسكان',
    coordinator: coordinatorOf(course),
    paragraphs: [
      `تستضيف وكالة الجامعة للتدريب المدرب <strong>${esc(t.nameAr || t.nameEn)}</strong>
       لتقديم البرنامج التدريبي <strong>«${esc(course.name)}»</strong> خلال الفترة من
       ${gregorian(course.startDate)} إلى ${gregorian(course.endDate)}.`,
      `وآمل التكرّم بالتوجيه باستضافته وإسكانه مدة إقامته في المملكة، من
       <strong>${gregorian(stay.from)}</strong> إلى <strong>${gregorian(stay.to)}</strong>
       (${stay.nights} ${stay.nights > 10 ? 'ليلة' : stay.nights > 2 ? 'ليالٍ' : stay.nights === 2 ? 'ليلتان' : 'ليلة'})،
       وفق التذكرة المصدرة له، مرفقاً بالرسالة موافقة معالي الرئيس، وتذكرة المدرب، وصورة جواز سفره.`,
    ],
    tables: [
      infoTable(programRows(course)),
      infoTable([
        ['اسم الضيف', t.nameAr || t.nameEn],
        ['الاسم كما في جواز السفر', t.nameEn],
        ['الجنسية', t.nationality],
        ['رقم جواز السفر', t.passportNo],
        ['الجوال', t.mobile],
        ['الوصول', flightText(t.arrival)],
        ['المغادرة', flightText(t.departure)],
        ['ملاحظات', t.notes],
      ]),
    ],
  });
}

const setting = (key) => configService.getSetting(key, MAIL_DEFAULTS[key]);

/** يبني رسالة البريد المطلوبة ويسجّل وقت إخراجها */
async function email(trackingId, output, user, activeRole) {
  if (!OUTPUTS.includes(output)) throw httpError(400, 'رسالة غير معروفة', 'serverErrors.trainer.badOutput');
  const item = await loadForEdit(trackingId, user, activeRole);
  const t = item.formData?.trainer;
  if (!t || !(t.nameAr || t.nameEn)) throw httpError(400, 'أدخل بيانات المدرب واحفظها أولاً', 'serverErrors.trainer.dataMissing');
  if (output === 'hr' && (!t.nameEn || !t.passportNo || !t.departureCity)) {
    throw httpError(400, 'لإصدار التذاكر: أكمل الاسم كما في الجواز، ورقم الجواز، ومدينة السفر', 'serverErrors.trainer.hrIncomplete');
  }
  if (output !== 'hr' && !hasTicket(t)) {
    throw httpError(400, 'أدخل مواعيد الوصول والمغادرة من التذكرة المصدرة أولاً', 'serverErrors.trainer.ticketMissing');
  }
  const course = await prisma.course.findUnique({
    where: { id: item.courseId },
    select: { name: true, city: true, startDate: true, endDate: true, primaryEmployee: { select: { firstName: true, lastName: true } } },
  });
  const who = t.nameAr || t.nameEn;
  const spec = {
    hr: { to: 'trainer.hr.email.to', cc: 'trainer.hr.email.cc', subject: `طلب إصدار تذاكر سفر لمدرب — ${who} — ${course.name}`, html: () => renderHrEmail(course, t), prefix: 'trainer-tickets' },
    protocol: { to: 'trainer.protocol.email.to', cc: 'trainer.protocol.email.cc', subject: `طلب استقبال وتوديع ضيف — ${who} — ${course.name}`, html: () => renderProtocolEmail(course, t), prefix: 'trainer-reception' },
    hospitality: { to: 'trainer.hospitality.email.to', cc: 'trainer.hospitality.email.cc', subject: `طلب استضافة وإسكان مدرب — ${who} — ${course.name}`, html: () => renderHospitalityEmail(course, t), prefix: 'trainer-hospitality' },
  }[output];
  const [to, cc] = await Promise.all([setting(spec.to), setting(spec.cc)]);
  const eml = buildEmlMessage({ to, cc, subject: spec.subject, htmlBody: spec.html() });
  // سجل الإخراج: يرى المنسق ما أخرجه من الرسائل الثلاث
  const sent = { ...(item.formData?.trainerMailSent || {}), [output]: new Date().toISOString() };
  await prisma.courseClosureTracking.update({ where: { id: trackingId }, data: { formData: { ...(item.formData || {}), trainerMailSent: sent } } });
  return { eml, prefix: spec.prefix, courseName: course.name };
}

module.exports = {
  ELEMENT_KEY, MAIL_DEFAULTS, OUTPUTS, cleanTrainer, stayDates, get, save, email,
  renderHrEmail, renderProtocolEmail, renderHospitalityEmail,
};
