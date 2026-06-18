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

module.exports = { createProjectSchema, updateProjectSchema };
