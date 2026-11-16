-- =============================================================
-- توثيق الدورة — عنصر التميّز
-- -------------------------------------------------------------
-- اختياري في كل دورة: من وثّقها ونشرها بالحد الأدنى من الجودة
-- نال نجمة تميّز ودرجات إضافية، ومن لم يوثّق لا يُخصم عليه شيء.
--
-- آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً. نوع المعرّفات يؤخذ
-- من جداولها وقت التطبيق (UUID في فيرسل، ونصّي في خادم الجامعة).
-- الصور نفسها لا تُحفظ هنا بل في مخزن ملفات المنصة.
-- =============================================================

DO $$
DECLARE
  t_user   text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"User"'::regclass AND attname = 'id');
  t_course text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                     WHERE attrelid = '"Course"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "CourseDocumentation" (
      "id"            %1$s NOT NULL,
      "courseId"      %2$s NOT NULL,
      "status"        TEXT NOT NULL DEFAULT 'DRAFT',
      "slug"          TEXT,
      "intro"         TEXT,
      "closing"       TEXT,
      "coverMediaId"  TEXT,
      "publishedAt"   TIMESTAMP(3),
      "publishedById" TEXT,
      "starAwarded"   BOOLEAN NOT NULL DEFAULT false,
      "starAwardedAt" TIMESTAMP(3),
      "views"         INTEGER NOT NULL DEFAULT 0,
      "createdById"   TEXT,
      "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CourseDocumentation_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_user, t_course);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "CourseDocumentation_courseId_key" ON "CourseDocumentation"("courseId");
CREATE UNIQUE INDEX IF NOT EXISTS "CourseDocumentation_slug_key" ON "CourseDocumentation"("slug");
CREATE INDEX IF NOT EXISTS "CourseDocumentation_status_idx" ON "CourseDocumentation"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseDocumentation_courseId_fkey') THEN
    ALTER TABLE "CourseDocumentation"
      ADD CONSTRAINT "CourseDocumentation_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
DECLARE
  t_doc text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                  WHERE attrelid = '"CourseDocumentation"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "DocumentationMedia" (
      "id"              %1$s NOT NULL,
      "documentationId" %1$s NOT NULL,
      "fileKey"         TEXT NOT NULL,
      "thumbKey"        TEXT NOT NULL,
      "width"           INTEGER NOT NULL,
      "height"          INTEGER NOT NULL,
      "size"            INTEGER NOT NULL,
      "caption"         TEXT,
      "sortOrder"       INTEGER NOT NULL DEFAULT 0,
      "uploadedById"    TEXT,
      "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DocumentationMedia_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_doc);
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "DocumentationSession" (
      "id"              %1$s NOT NULL,
      "documentationId" %1$s NOT NULL,
      "title"           TEXT NOT NULL,
      "presenter"       TEXT,
      "date"            TIMESTAMP(3),
      "time"            TEXT,
      "description"     TEXT,
      "sortOrder"       INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "DocumentationSession_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_doc);
END $$;

CREATE INDEX IF NOT EXISTS "DocumentationMedia_documentationId_sortOrder_idx" ON "DocumentationMedia"("documentationId", "sortOrder");
CREATE INDEX IF NOT EXISTS "DocumentationSession_documentationId_sortOrder_idx" ON "DocumentationSession"("documentationId", "sortOrder");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentationMedia_documentationId_fkey') THEN
    ALTER TABLE "DocumentationMedia"
      ADD CONSTRAINT "DocumentationMedia_documentationId_fkey"
      FOREIGN KEY ("documentationId") REFERENCES "CourseDocumentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentationSession_documentationId_fkey') THEN
    ALTER TABLE "DocumentationSession"
      ADD CONSTRAINT "DocumentationSession_documentationId_fkey"
      FOREIGN KEY ("documentationId") REFERENCES "CourseDocumentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- مكافأة التوثيق المميّز في لقطة الأداء — لا ينقص بها شيء
ALTER TABLE "EmployeeKpiSnapshot" ADD COLUMN IF NOT EXISTS "excellenceBonus" DOUBLE PRECISION NOT NULL DEFAULT 0;
