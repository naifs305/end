// إعدادات النظام المركزية
// ================================================================

/**
 * تاريخ البداية الرسمي لاحتساب المؤشرات الحقيقية
 * ما قبل هذا التاريخ يُعدّ بيانات تجريبية ويُخفى افتراضياً
 */
const OFFICIAL_KPI_START = process.env.OFFICIAL_KPI_START || '2026-06';

/**
 * هل الفترة رسمية (بعد أو مساوية تاريخ البداية الرسمي)
 */
function isOfficialPeriod(periodLabel) {
  if (!periodLabel) return false;
  return periodLabel >= OFFICIAL_KPI_START;
}

/**
 * تحويل ساعات إلى نص قابل للقراءة
 * < 24 ساعة  →  "X ساعة"
 * ≥ 24 ساعة  →  "X.X يوم" أو "X يوم"
 */
function fmtDuration(hours) {
  if (hours == null || isNaN(Number(hours))) return '—';
  const h = Number(hours);
  if (h === 0) return 'فوري';
  if (h < 1)   return 'أقل من ساعة';
  if (h < 24)  return `${Math.round(h)} ساعة`;
  const days = h / 24;
  if (days < 2) return `${days.toFixed(1)} يوم`;
  return `${Math.round(days)} يوم`;
}

/**
 * مضاعف الدورة العابرة للمشاريع في احتساب KPI
 * الدورات خارج مشروع الموظف تحسب بوزن أعلى
 */
const CROSS_PROJECT_MULTIPLIER = 1.3; // 30% مكافأة

module.exports = { OFFICIAL_KPI_START, isOfficialPeriod, fmtDuration, CROSS_PROJECT_MULTIPLIER };
