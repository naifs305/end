// =============================================================
// مخطّطات التحقّق (zod) لمدخلات الكتابة/الاحتساب في وحدة KPI
// ملاحظة: المسارات تحافظ على رموز الأخطاء الخاصة (serverErrors.kpis.*)
// لذلك التحقّق الدقيق يبقى في المعالِجات؛ هذه المخطّطات توثّق الأشكال
// وتُستخدم حيث لا تُغيّر رموز الاستجابة.
// =============================================================
const { z } = require('zod');

const periodType = z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']);

// POST /api/kpis/calculate
const calculateSchema = z.object({
  periodType,
  year: z.coerce.number().int(),
  value: z.coerce.number().int().optional(),
});

// POST /api/kpis/calculate-yearly
const calculateYearlySchema = z.object({
  year: z.coerce.number().int().min(2024).max(2030),
});

// POST /api/kpis/assignments — upsert إسناد
const upsertAssignmentSchema = z.object({
  userId: z.string().min(1),
  periodType,
  year: z.coerce.number().int(),
  value: z.coerce.number().int().optional(),
  assignedCoursesCount: z.coerce.number().int().min(0),
  notes: z.string().optional().nullable(),
});

// POST /api/kpis/snapshots/[snapshotId]/notes — ملاحظة مدير
const addNoteSchema = z.object({
  userId: z.string().min(1),
  note: z.string().min(1),
});

module.exports = {
  periodType,
  calculateSchema,
  calculateYearlySchema,
  upsertAssignmentSchema,
  addNoteSchema,
};
