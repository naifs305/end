// =============================================================
// مخطّطات التحقّق (zod) لوحدة الإقفال
// مدخلات الإقفال (التقارير/المالية/تحديث الحالة) تُمرَّر كما هي ويتم
// التحقّق منها حرفياً داخل الخدمة (آلة الحالة)؛ لذا نستخدم passthrough.
// أما التمديد (extend) فله تحقّق حافة صريح يطابق المنطق القديم.
// =============================================================
const { z } = require('zod');

// آلة حالة العنصر — البيانات تُحلَّل داخل الخدمة
const updateStatusSchema = z.object({}).passthrough();
const reportSchema = z.object({}).passthrough();
const advanceSchema = z.object({}).passthrough();
const settlementSchema = z.object({}).passthrough();
const manualFinancialCloseSchema = z.object({}).passthrough();

// extend — يُتحقّق منه في المعالِج للحفاظ على رموز الأخطاء الدقيقة
// (serverErrors.closure.extensionHoursInvalid / extensionReasonRequired)

// إدارة عناصر الإقفال الرئيسية — التحقّق الدقيق داخل الخدمة (رموز خاصة)
const createElementSchema = z.object({}).passthrough();
const updateElementSchema = z.object({}).passthrough();

module.exports = {
  updateStatusSchema,
  reportSchema,
  advanceSchema,
  settlementSchema,
  manualFinancialCloseSchema,
  createElementSchema,
  updateElementSchema,
};
