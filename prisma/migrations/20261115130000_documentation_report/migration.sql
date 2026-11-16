-- =============================================================
-- التقرير الفني لتوثيق الدورة: ملخصه وتوصياته، ومتدربوه بصورهم
-- ودرجاتهم وما تميّزوا به. التقرير يُستخرج من داخل المنصة وحدها،
-- ولا يظهر في المجلة العامة.
--
-- آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً. نوع المعرّفات يؤخذ
-- من جدوله وقت التطبيق (UUID في فيرسل، ونصّي في خادم الجامعة).
-- =============================================================

ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "reportSummary" TEXT;
ALTER TABLE "CourseDocumentation" ADD COLUMN IF NOT EXISTS "recommendations" TEXT;

DO $$
DECLARE
  t_doc text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                  WHERE attrelid = '"CourseDocumentation"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "DocumentationTrainee" (
      "id"              %1$s NOT NULL,
      "documentationId" %1$s NOT NULL,
      "name"            TEXT NOT NULL,
      "entity"          TEXT,
      "score"           DOUBLE PRECISION,
      "distinction"     TEXT,
      "isDistinguished" BOOLEAN NOT NULL DEFAULT false,
      "photoKey"        TEXT,
      "sortOrder"       INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "DocumentationTrainee_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_doc);
END $$;

CREATE INDEX IF NOT EXISTS "DocumentationTrainee_documentationId_sortOrder_idx" ON "DocumentationTrainee"("documentationId", "sortOrder");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentationTrainee_documentationId_fkey') THEN
    ALTER TABLE "DocumentationTrainee"
      ADD CONSTRAINT "DocumentationTrainee_documentationId_fkey"
      FOREIGN KEY ("documentationId") REFERENCES "CourseDocumentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
