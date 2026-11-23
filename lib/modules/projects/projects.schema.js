// =============================================================
// مخطّطات التحقّق (zod) لوحدة المشاريع
// =============================================================
const { z } = require('zod');

const projectName = z
  .string({ required_error: 'اسم المشروع مطلوب' })
  .trim()
  .min(1, 'اسم المشروع مطلوب')
  .max(120, 'اسم المشروع طويل جداً');

const createProjectSchema = z.object({ name: projectName });
const updateProjectSchema = z.object({ name: projectName });

const domainName = z
  .string({ required_error: 'اسم المجال مطلوب' })
  .trim()
  .min(2, 'اسم المجال مطلوب')
  .max(120, 'اسم المجال طويل جداً');

const createDomainSchema = z.object({ name: domainName, operationalProjectId: z.string().min(1, 'اختر المشروع') });
const updateDomainSchema = z
  .object({ name: domainName.optional(), operationalProjectId: z.string().min(1).optional() })
  .refine((v) => v.name !== undefined || v.operationalProjectId !== undefined, 'لا يوجد ما يُعدَّل');

module.exports = { createProjectSchema, updateProjectSchema, createDomainSchema, updateDomainSchema };
