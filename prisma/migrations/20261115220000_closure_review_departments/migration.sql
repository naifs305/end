-- =============================================================
-- تقييم صعوبات الإقفال ومؤشر أداء الإدارات
-- -------------------------------------------------------------
-- بعد إقفال الدورة يسجّل المنسق ما واجهه من الإدارات الأخرى، فيُبنى
-- منه مؤشر أداء لكل إدارة. آمن لإعادة التشغيل، ولا يمسّ بياناً قائماً.
-- أنواع المعرّفات تؤخذ من جداولها وقت التطبيق (UUID في فيرسل، ونصّية في الجامعة).
-- =============================================================

DO $$
DECLARE
  t_user   text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = '"User"'::regclass AND attname = 'id');
  t_course text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute WHERE attrelid = '"Course"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "ClosureReview" (
      "id"        %1$s NOT NULL,
      "courseId"  %2$s NOT NULL,
      "authorId"  %3$s,
      "noIssues"  BOOLEAN NOT NULL DEFAULT false,
      "note"      TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClosureReview_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_course, t_course, t_user);

  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "DepartmentIssue" (
      "id"         %1$s NOT NULL,
      "reviewId"   %1$s NOT NULL,
      "courseId"   %2$s NOT NULL,
      "department" TEXT NOT NULL,
      "issueType"  TEXT NOT NULL,
      "impact"     TEXT NOT NULL DEFAULT 'MEDIUM',
      "delayDays"  INTEGER,
      "note"       TEXT,
      "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DepartmentIssue_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_course, t_course);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClosureReview_courseId_key" ON "ClosureReview"("courseId");
CREATE INDEX IF NOT EXISTS "ClosureReview_createdAt_idx" ON "ClosureReview"("createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentIssue_department_createdAt_idx" ON "DepartmentIssue"("department", "createdAt");
CREATE INDEX IF NOT EXISTS "DepartmentIssue_courseId_idx" ON "DepartmentIssue"("courseId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClosureReview_courseId_fkey') THEN
    ALTER TABLE "ClosureReview" ADD CONSTRAINT "ClosureReview_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClosureReview_authorId_fkey') THEN
    ALTER TABLE "ClosureReview" ADD CONSTRAINT "ClosureReview_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DepartmentIssue_reviewId_fkey') THEN
    ALTER TABLE "DepartmentIssue" ADD CONSTRAINT "DepartmentIssue_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "ClosureReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
