// =============================================================
// مواعيد عناصر الإقفال — المصدر الوحيد للحقيقة
// -------------------------------------------------------------
// كل ما في المنصة يحسب مواعيد العناصر من هنا: محرك المؤشرات،
// شاشة الدورة، لوحة المنسق، والتقارير. لا يجوز حساب أي موعد
// في مكان آخر — تعدّد المصادر يُنتج موعداً يراه المنسق وموعداً
// آخر يُحاسَب عليه.
//
// يراعي الحساب أربعة مؤثّرات، بهذا الترتيب:
//   ١. نقطة المرجع (بداية الدورة أو نهايتها) + ساعات المهلة.
//   ٢. أيام العمل — تُتخطّى الجمعة والسبت عند عناصر isDeadlineWorkingDays.
//   ٣. التمديد الممنوح من المدير (يؤجّل الموعد الأقصى وحده).
//   ٤. بلاغات العوائق المحتسَبة (تؤجّل الموعدين وفق وقت رفع البلاغ).
// ثم حالة خاصة: الدورة المُدخلة متأخراً بمبرر مقبول.
// =============================================================

const MS_HOUR = 1000 * 60 * 60;

// عطلة نهاية الأسبوع في السعودية: الجمعة (5) والسبت (6) — getDay(): 0=الأحد
const WEEKEND_DAYS = new Set([5, 6]);

function isWorkingDay(date) {
  return !WEEKEND_DAYS.has(date.getDay());
}

/**
 * يضيف مدةً بالساعات إلى تاريخ مرجعي.
 * - الوضع التقويمي (الافتراضي): جمع مباشر للساعات.
 * - وضع أيام العمل: تُستهلك الساعات على أيام العمل فقط ويُتخطّى يوما العطلة.
 * الساعات السالبة أو الصفرية تُجمع تقويمياً دائماً (مواعيد ما قبل المرجع).
 */
function addDeadlineHours(refDate, hours, isWorkingDays) {
  const h = Number.isFinite(hours) ? hours : 0;
  if (!isWorkingDays || h <= 0) {
    return new Date(refDate.getTime() + h * MS_HOUR);
  }
  let cursor = refDate.getTime();
  let remaining = h;
  while (remaining > 0) {
    const d = new Date(cursor);
    const nextMidnight = new Date(d);
    nextMidnight.setHours(24, 0, 0, 0);
    if (isWorkingDay(d)) {
      const hoursToMidnight = (nextMidnight.getTime() - cursor) / MS_HOUR;
      if (remaining <= hoursToMidnight) {
        return new Date(cursor + remaining * MS_HOUR);
      }
      remaining -= hoursToMidnight;
    }
    cursor = nextMidnight.getTime();
  }
  return new Date(cursor);
}

// ── بلاغات العوائق ───────────────────────────────────────────
// يُحتسب البلاغ فقط إن كان معتمداً (تلقائياً أو بقرار المدير).
function isCreditedBlocker(b) {
  return !!b && b.isCredited === true && b.status !== 'CANCELLED';
}

function hasOpenBlocker(tracking) {
  return (tracking?.blockers || []).some((b) => b && b.status === 'OPEN');
}

/**
 * يدمج فترات البلاغات المتداخلة ويعيد مجموع ساعاتها.
 * التداخل لا يُحتسب مرتين — منسق متوقف بعائقين في وقت واحد
 * متوقف مرة واحدة.
 * @param {Array} blockers بلاغات العنصر
 * @param {Date}  now      اللحظة الحالية (البلاغ المفتوح يمتدّ إليها)
 * @param {Date}  raisedNotAfter لا تُحتسب البلاغات المرفوعة بعد هذا التاريخ
 */
function mergedPauseHours(blockers, now, raisedNotAfter) {
  const spans = [];

  for (const b of blockers || []) {
    if (!isCreditedBlocker(b)) continue;
    const start = b.raisedAt ? new Date(b.raisedAt) : null;
    if (!start || Number.isNaN(start.getTime())) continue;
    // الضابط الجوهري: البلاغ المرفوع بعد فوات الموعد لا يؤجّله.
    // هذا ما يسدّ باب الادّعاء بأثر رجعي.
    if (raisedNotAfter && start > raisedNotAfter) continue;

    const end = b.resolvedAt ? new Date(b.resolvedAt) : now;
    if (Number.isNaN(end.getTime()) || end <= start) continue;
    spans.push([start.getTime(), end.getTime()]);
  }

  if (!spans.length) return 0;

  spans.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = spans[0][0];
  let curEnd = spans[0][1];

  for (let i = 1; i < spans.length; i += 1) {
    const s = spans[i][0];
    const e = spans[i][1];
    if (s <= curEnd) {
      if (e > curEnd) curEnd = e;
    } else {
      total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  total += curEnd - curStart;

  return total / MS_HOUR;
}

// ── تغيّر نوع الشهادة بعد تأكيده ─────────────────────────────
const CERT_CHANGE_GRACE_HOURS = 72;
const CERT_TEST_KEYS = ['pre_test', 'post_test'];

/**
 * الاختبار الذي يحلّ موعده الأقصى قبل مرور ٧٢ ساعة على معرفة النوع يُستثنى
 * توقيته: سواء تغيّر النوع بعد تأكيده، أو أُكّد ما كان معلّقاً متأخراً.
 */
function exemptByCertificateChange(elementKey, course, maxDeadline) {
  if (!CERT_TEST_KEYS.includes(elementKey) || !course || !maxDeadline) return false;
  const known = [course.certificateTypeChangedAt, course.certificateTypeResolvedAt]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter((t) => !Number.isNaN(t));
  if (!known.length) return false;
  return new Date(maxDeadline).getTime() < Math.max(...known) + CERT_CHANGE_GRACE_HOURS * MS_HOUR;
}

/**
 * يحسب مواعيد عنصر إقفال واحد — الدالة التي يبني عليها كل شيء.
 *
 * @param {object} tracking سجل متابعة العنصر (ومعه element و blockers)
 * @param {object} course   الدورة (startDate/endDate وحقول الإدخال المتأخر)
 * @param {Date}   now      اللحظة المرجعية — تُمرَّر في الاختبارات
 */
function computeElementDeadlines(tracking, course, now = new Date()) {
  const el = tracking && tracking.element;

  const empty = {
    hasDeadline: false,
    refDate: null,
    baseIdealDeadline: null,
    baseMaxDeadline: null,
    idealDeadline: null,
    maxDeadline: null,
    extensionHours: 0,
    idealPauseHours: 0,
    maxPauseHours: 0,
    hasOpenBlocker: hasOpenBlocker(tracking),
    excludedFromTiming: false,
    exclusionReason: null,
    isOverdue: false,
  };

  if (!course || !el || !el.deadlineRefPoint || el.deadlineIdealHours == null || el.deadlineMaxHours == null) {
    return empty;
  }

  const refSource = el.deadlineRefPoint === 'START' ? course.startDate : course.endDate;
  if (!refSource) return empty;

  const refDate = new Date(refSource);
  if (Number.isNaN(refDate.getTime())) return empty;

  const workingDays = !!el.isDeadlineWorkingDays;
  const extensionHours = Number(tracking.extensionHours) || 0;

  // ① المواعيد الأساسية — قبل أي بلاغ
  const baseIdealDeadline = addDeadlineHours(refDate, el.deadlineIdealHours, workingDays);
  // التمديد يؤجّل الأقصى وحده: قرار المدير يرفع العقوبة ولا يمنح التميّز
  const baseMaxDeadline = addDeadlineHours(
    addDeadlineHours(refDate, el.deadlineMaxHours, workingDays),
    extensionHours,
    workingDays,
  );

  // ② تأجيل البلاغات — كلٌّ يُقاس على الموعد الأساسي الذي رُفع قبله:
  //    مَن أبلغ قبل الموعد المثالي حفظ الموعدين،
  //    ومَن أبلغ بعده وقبل الأقصى حفظ الأقصى وحده،
  //    ومَن أبلغ بعد الأقصى لم يحفظ شيئاً.
  const blockers = tracking.blockers || [];
  const idealPauseHours = mergedPauseHours(blockers, now, baseIdealDeadline);
  const maxPauseHours = mergedPauseHours(blockers, now, baseMaxDeadline);

  const idealDeadline = addDeadlineHours(baseIdealDeadline, idealPauseHours, workingDays);
  const maxDeadline = addDeadlineHours(baseMaxDeadline, maxPauseHours, workingDays);

  // ③ الدورة المُدخلة متأخراً بمبرر مقبول — العنصر الذي فات موعده
  //    قبل أن تُدخَل الدورة أصلاً كان مستحيلاً، فلا يُحتسب في التوقيت.
  let excludedFromTiming = false;
  let exclusionReason = null;

  if (course.lateEntryStatus === 'ACCEPTED' && course.entryBaselineAt) {
    const baseline = new Date(course.entryBaselineAt);
    if (!Number.isNaN(baseline.getTime()) && maxDeadline < baseline) {
      excludedFromTiming = true;
      exclusionReason = 'LATE_ENTRY_ACCEPTED';
    }
  }

  // ④ عُرف نوع الشهادة متأخراً (تغيّر بعد تأكيده، أو أُكّد المعلّق قرب
  //    النهاية): الاختبار الذي استجدّ بلا مهلة كافية لا يُحاسَب عليه المنسق.
  if (!excludedFromTiming && exemptByCertificateChange(el.key, course, maxDeadline)) {
    excludedFromTiming = true;
    exclusionReason = 'CERTIFICATE_TYPE_CHANGED';
  }

  const submittedAt = tracking.executionAt ? new Date(tracking.executionAt) : null;
  const isOverdue = !excludedFromTiming
    && (submittedAt ? submittedAt > maxDeadline : now > maxDeadline);

  return {
    hasDeadline: true,
    refDate,
    baseIdealDeadline,
    baseMaxDeadline,
    idealDeadline,
    maxDeadline,
    extensionHours,
    idealPauseHours,
    maxPauseHours,
    hasOpenBlocker: hasOpenBlocker(tracking),
    excludedFromTiming,
    exclusionReason,
    isOverdue,
  };
}

/**
 * درجة التوقيت لعنصر واحد — الدالة التي تحكم المؤشرات.
 * 100 = في الموعد المثالي · 70 = قبل الأقصى · 20 = بعد الأقصى
 * null = لا يُحتسب بعد (لم يحن موعده، أو لا موعد له، أو مستثنى)
 */
function calcElementTimeScore(tracking, course, now = new Date()) {
  const d = computeElementDeadlines(tracking, course, now);

  if (!d.hasDeadline) {
    return tracking && tracking.executionAt ? 100 : null;
  }

  // عنصر كان مستحيلاً قبل إدخال الدورة — لا عقوبة ولا تميّز
  if (d.excludedFromTiming) return null;

  if (!tracking.executionAt) {
    return now > d.maxDeadline ? 0 : null;
  }

  const submittedAt = new Date(tracking.executionAt);
  if (submittedAt <= d.idealDeadline) return 100;
  if (submittedAt <= d.maxDeadline) return 70;
  return 20;
}

module.exports = {
  MS_HOUR,
  isWorkingDay,
  addDeadlineHours,
  mergedPauseHours,
  hasOpenBlocker,
  computeElementDeadlines,
  calcElementTimeScore,
};
