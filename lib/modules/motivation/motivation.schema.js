// =============================================================
// مخطّطات التحقّق (zod) لوحدة التحفيز — على عمليات الكتابة
// تحاكي رسائل التحقّق الأصلية بالحرف نفسه.
// =============================================================
const { z } = require('zod');

const awardBadgeSchema = z.object({
  userId: z.string().min(1),
  badgeType: z.string().min(1),
  periodLabel: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
}).passthrough();

const createChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  targetMetric: z.string().min(1),
  targetValue: z.union([z.number(), z.string()]),
  periodLabel: z.string().optional().nullable(),
}).passthrough();

const createIdeaSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().optional().nullable(),
}).passthrough();

const savePledgeSchema = z.object({
  pledge1: z.string().min(1),
  pledge2: z.string().optional().nullable(),
  pledge3: z.string().optional().nullable(),
  periodLabel: z.string().optional().nullable(),
}).passthrough();

module.exports = {
  awardBadgeSchema,
  createChallengeSchema,
  createIdeaSchema,
  savePledgeSchema,
};
