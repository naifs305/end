// =============================================================
// الإدخال المتأخر للدورة
// -------------------------------------------------------------
// المبدأ: لا نمنع الإدخال أبداً. المنع يجعل المنسق لا يُدخل الدورة
// إطلاقاً، فتضيع من السجل كله — وهذا أسوأ من تأخر الإدخال بما لا
// يقاس. فالدورة تُضاف في كل حال.
//
// والتأخير تكتشفه المنصة بنفسها بمقارنة لحظة الإدخال بتواريخ
// الدورة، فلا يستطيع المنسق الكذب فيه. المبرر وحده هو ما ينظر
// فيه المدير: قُبِل فلا ملاحظة، ورُفِض فتُسجَّل نقطة متدرّجة.
//
// والأهم: الدورة المُدخلة متأخرة تصل ومعها عناصر فات موعدها في
// اللحظة نفسها. فعند قبول المبرر تُستثنى تلك العناصر من احتساب
// التوقيت — وإلا انهار أداء المنسق فور الإدخال وصار قبول المدير
// بلا قيمة. (التنفيذ في lib/shared/deadlines)
// =============================================================
const config = require('../config/config.service');

const DEFAULT_LEAD_HOURS = 72; // أبكر مهلة عنصر: تسجيل المتدربين قبل البداية بـ٧٢ ساعة
const LEAD_SETTING_KEY = 'course.entryLeadHours';

async function getEntryLeadHours() {
  const raw = await config.getSetting(LEAD_SETTING_KEY, String(DEFAULT_LEAD_HOURS));
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_LEAD_HOURS;
}

/**
 * يقيس تأخّر الإدخال.
 * الموعد المتوقّع للإدخال = بداية الدورة ناقص مهلة التقديم،
 * لأن أول عنصر مطلوب (تسجيل المتدربين) يستحق قبل البداية بـ٧٢ ساعة —
 * فالدورة التي تُدخَل بعد ذلك تصل وعنصرها الأول متأخر أصلاً.
 */
function measureLateness(startDate, now, leadHours) {
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return { isLate: false, hoursLate: 0, expectedBy: null };
  }

  const expectedBy = new Date(start.getTime() - leadHours * 3600000);
  const hoursLate = (now.getTime() - expectedBy.getTime()) / 3600000;

  return {
    isLate: hoursLate > 0,
    hoursLate: hoursLate > 0 ? Math.round(hoursLate) : 0,
    expectedBy,
  };
}

/**
 * الحالة الصحيحة للدورة وقت الإدخال.
 * المنصة كانت تنشئ كل دورة في "تحت الإعداد" ولو كانت منتهية منذ
 * شهر — فتظهر دورة منتهية بحالة إعداد.
 */
function deriveStatusFromDates(startDate, endDate, now) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (!Number.isNaN(end.getTime()) && end < now) return 'AWAITING_CLOSURE';
  if (!Number.isNaN(start.getTime()) && start <= now) return 'EXECUTION';
  return 'PREPARATION';
}

/**
 * يبني حقول الإدخال المتأخر عند إنشاء الدورة.
 * @throws عند التأخر بلا مبرر — المبرر إلزامي، لا اختياري.
 */
async function buildLateEntryFields(dto, now = new Date()) {
  const leadHours = await getEntryLeadHours();
  const { isLate, hoursLate, expectedBy } = measureLateness(dto.startDate, now, leadHours);

  if (!isLate) {
    return {
      fields: {
        isLateEntry: false,
        entryBaselineAt: now,
        status: deriveStatusFromDates(dto.startDate, dto.endDate, now),
      },
      isLate: false,
      hoursLate: 0,
      expectedBy,
    };
  }

  const reason = String(dto.lateEntryReason || '').trim();

  return {
    fields: {
      isLateEntry: true,
      lateEntryHours: hoursLate,
      lateEntryReason: reason,
      lateEntryStatus: 'PENDING',
      entryBaselineAt: now,
      status: deriveStatusFromDates(dto.startDate, dto.endDate, now),
    },
    isLate: true,
    hoursLate,
    expectedBy,
    reason,
  };
}

/** النقطة المتدرّجة — دورة تأخرت يوماً ليست كدورة أُدخلت بعد انتهائها */
function penaltyPointsFor(hoursLate) {
  const days = Math.max(0, Number(hoursLate) || 0) / 24;
  if (days <= 1) return 2;
  if (days <= 3) return 4;
  if (days <= 7) return 7;
  return 10;
}

function describeLateness(hoursLate) {
  const days = Math.round((Number(hoursLate) || 0) / 24);
  if (days < 1) return 'أقل من يوم';
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان';
  if (days <= 10) return `${days} أيام`;
  return `${days} يوماً`;
}

module.exports = {
  DEFAULT_LEAD_HOURS,
  LEAD_SETTING_KEY,
  getEntryLeadHours,
  measureLateness,
  deriveStatusFromDates,
  buildLateEntryFields,
  penaltyPointsFor,
  describeLateness,
};
