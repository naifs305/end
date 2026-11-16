-- =============================================================
-- نموذج مؤشرات الأداء الثاني: أربعة محاور (الالتزام ٦٠٪، الجودة ١٠٪،
-- الإقفال ٢٠٪، التميّز والتعاون ١٠٪) وترتيب بمتوسط ثلاثة أشهر.
-- أعمدة جديدة على لقطات الأداء، ومهمة يومية تحتسب المؤشرات تلقائياً.
-- آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً.
-- =============================================================

ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "excellenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "rollingScore" DOUBLE PRECISION;
ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "isSubjectToEvaluation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "modelVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "breakdown" JSONB;

-- احتساب يومي للشهر الجاري (ولِما قبله في أيامه الخمسة الأولى)
INSERT INTO "ScheduledJob" ("id", "name", "type", "status", "intervalHours", "payload", "nextRunAt", "createdAt", "updatedAt")
SELECT
  'd7a3c1e9-5b20-4c8f-8e61-2f9b4a0c7d15',
  'احتساب مؤشرات الأداء',
  'KPI_AUTO_SNAPSHOT',
  'ACTIVE',
  24,
  '{"periodType":"MONTHLY"}'::JSONB,
  CURRENT_TIMESTAMP + INTERVAL '1 hour',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ScheduledJob" WHERE "type" = 'KPI_AUTO_SNAPSHOT');
