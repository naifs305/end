// POST /api/admin/migrate-phase2 — يُشغَّل مرة واحدة لإضافة أعمدة المرحلة الثانية
// المدير فقط — يُحذف بعد التأكيد من نجاح العملية
const { PrismaClient } = require('@prisma/client');
const { withManager, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  // استخدام DIRECT_URL لتجاوز pgbouncer
  const directPrisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
  });

  const steps = [
    { name: 'ClosureElement.deadlineRefPoint',      sql: `ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineRefPoint" TEXT` },
    { name: 'ClosureElement.deadlineIdealHours',    sql: `ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineIdealHours" INTEGER` },
    { name: 'ClosureElement.deadlineMaxHours',      sql: `ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "deadlineMaxHours" INTEGER` },
    { name: 'ClosureElement.isDeadlineWorkingDays', sql: `ALTER TABLE "ClosureElement" ADD COLUMN IF NOT EXISTS "isDeadlineWorkingDays" BOOLEAN NOT NULL DEFAULT false` },
    { name: 'Course.requiresPreTest',               sql: `ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "requiresPreTest" BOOLEAN NOT NULL DEFAULT false` },
    { name: 'Course.requiresPostTest',              sql: `ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "requiresPostTest" BOOLEAN NOT NULL DEFAULT false` },
    { name: 'CourseClosureTracking.delayReason',    sql: `ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "delayReason" TEXT` },
    { name: 'CourseClosureTracking.extensionGrantedAt',   sql: `ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionGrantedAt" TIMESTAMP(3)` },
    { name: 'CourseClosureTracking.extensionGrantedById', sql: `ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionGrantedById" TEXT` },
    { name: 'CourseClosureTracking.extensionHours', sql: `ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionHours" INTEGER` },
    { name: 'CourseClosureTracking.extensionReason',sql: `ALTER TABLE "CourseClosureTracking" ADD COLUMN IF NOT EXISTS "extensionReason" TEXT` },
  ];

  const results = [];
  try {
    for (const step of steps) {
      try {
        await directPrisma.$executeRawUnsafe(step.sql);
        results.push({ step: step.name, status: 'ok' });
      } catch (e) {
        results.push({ step: step.name, status: 'error', message: e.message });
      }
    }

    // تحديث بيانات مواعيد العناصر
    const deadlines = [
      { key: 'trainee_registration', ref: 'START', ideal: -72,  max: -24,  wd: false },
      { key: 'registration_message', ref: 'START', ideal: -48,  max: 0,    wd: false },
      { key: 'advance_req',          ref: 'START', ideal: -120, max: -72,  wd: true  },
      { key: 'pre_test',             ref: 'START', ideal: 0,    max: 24,   wd: false },
      { key: 'opening_report',       ref: 'START', ideal: 0,    max: 24,   wd: false },
      { key: 'reaction_evaluation',  ref: 'END',   ideal: 0,    max: 24,   wd: false },
      { key: 'post_test',            ref: 'END',   ideal: 0,    max: 24,   wd: false },
      { key: 'certificates',         ref: 'END',   ideal: 72,   max: 120,  wd: true  },
      { key: 'closing_report',       ref: 'END',   ideal: 24,   max: 72,   wd: false },
      { key: 'supervisor_compensation', ref: 'END', ideal: 72,  max: 120,  wd: true  },
      { key: 'trainer_compensation', ref: 'END',   ideal: 72,   max: 120,  wd: true  },
      { key: 'revenues',             ref: 'END',   ideal: 72,   max: 120,  wd: false },
      { key: 'materials',            ref: 'END',   ideal: 24,   max: 72,   wd: false },
      { key: 'settlement',           ref: 'END',   ideal: 120,  max: 240,  wd: true  },
    ];

    for (const d of deadlines) {
      try {
        await directPrisma.$executeRawUnsafe(
          `UPDATE "ClosureElement" SET "deadlineRefPoint"=$1, "deadlineIdealHours"=$2, "deadlineMaxHours"=$3, "isDeadlineWorkingDays"=$4 WHERE key=$5`,
          d.ref, d.ideal, d.max, d.wd, d.key
        );
        results.push({ step: 'deadline:' + d.key, status: 'ok' });
      } catch (e) {
        results.push({ step: 'deadline:' + d.key, status: 'error', message: e.message });
      }
    }

    return res.status(200).json({ success: true, results });
  } finally {
    await directPrisma.$disconnect();
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
