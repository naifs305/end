-- =============================================================
-- تعليقات الزملاء على التقارير الميدانية
-- -------------------------------------------------------------
-- التقارير الميدانية صارت مفتوحة لكل المستخدمين ليطّلعوا على
-- ملاحظات زملائهم فيتلافوها، ولهم أن يعلّقوا عليها.
--
-- آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً. أنواع المعرّفات
-- تؤخذ من جداولها وقت التطبيق (UUID في فيرسل، ونصّية في الجامعة).
-- =============================================================

DO $$
DECLARE
  t_user   text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"User"'::regclass AND attname = 'id');
  t_report text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"FieldReport"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "FieldReportComment" (
      "id"        %1$s NOT NULL,
      "reportId"  %2$s NOT NULL,
      "authorId"  %3$s NOT NULL,
      "content"   TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FieldReportComment_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_user, t_report, t_user);
END $$;

CREATE INDEX IF NOT EXISTS "FieldReportComment_reportId_createdAt_idx" ON "FieldReportComment"("reportId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FieldReportComment_reportId_fkey') THEN
    ALTER TABLE "FieldReportComment"
      ADD CONSTRAINT "FieldReportComment_reportId_fkey"
      FOREIGN KEY ("reportId") REFERENCES "FieldReport"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FieldReportComment_authorId_fkey') THEN
    ALTER TABLE "FieldReportComment"
      ADD CONSTRAINT "FieldReportComment_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
