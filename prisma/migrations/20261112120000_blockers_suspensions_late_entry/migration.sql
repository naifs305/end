-- =============================================================
-- بلاغات العوائق + فترات إيقاف العناصر + الإدخال المتأخر للدورة
-- -------------------------------------------------------------
-- آمن لإعادة التشغيل (IF NOT EXISTS في كل خطوة)، ولا يحذف بياناً
-- ولا يغيّر قيمة قائمة. كل ما يضيفه اختياري أو له قيمة افتراضية،
-- فالنظام الحالي يعمل كما هو قبل أن يُفعّل أحد الميزات الجديدة.
--
-- ملاحظة على الأنواع: جداول المنصة الأساسية (المستخدم، الدورة،
-- عنصر الإقفال، سجل المتابعة) معرّفاتها من نوع UUID في قاعدة
-- البيانات، فكل عمود يشير إليها هنا UUID كذلك — وإلا رفضت قاعدة
-- البيانات الربط لاختلاف النوعين.
-- =============================================================

-- ── الأنواع (Enums) ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "BlockerReason" AS ENUM (
    'TRAINER_GRADES', 'TRAINEE_NAMES', 'INSURANCE_SUSPENDED',
    'FINANCE_PENDING', 'BENEFICIARY_PENDING', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'RESOLVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BlockerCredit" AS ENUM (
    'AUTO_APPROVED', 'QUOTA_EXCEEDED_PENDING', 'MANAGER_APPROVED', 'MANAGER_REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LateEntryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── فترات إيقاف عنصر الإقفال ────────────────────────────────
CREATE TABLE IF NOT EXISTS "ElementSuspension" (
  "id"          UUID NOT NULL,
  "elementId"   UUID NOT NULL,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "reason"      TEXT NOT NULL,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElementSuspension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ElementSuspension_elementId_isActive_idx"
  ON "ElementSuspension"("elementId", "isActive");
CREATE INDEX IF NOT EXISTS "ElementSuspension_startsAt_endsAt_idx"
  ON "ElementSuspension"("startsAt", "endsAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementSuspension_elementId_fkey'
  ) THEN
    ALTER TABLE "ElementSuspension"
      ADD CONSTRAINT "ElementSuspension_elementId_fkey"
      FOREIGN KEY ("elementId") REFERENCES "ClosureElement"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementSuspension_createdById_fkey'
  ) THEN
    ALTER TABLE "ElementSuspension"
      ADD CONSTRAINT "ElementSuspension_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── مرجع فترة الإيقاف على سجل متابعة العنصر ─────────────────
-- نُعلّم به ما أسقطته الفترة وحدها، لنعيده عند انتهائها بلا أن
-- نمسّ ما أعفاه المدير بقراره.
ALTER TABLE "CourseClosureTracking"
  ADD COLUMN IF NOT EXISTS "suspensionId" UUID;

CREATE INDEX IF NOT EXISTS "CourseClosureTracking_suspensionId_idx"
  ON "CourseClosureTracking"("suspensionId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CourseClosureTracking_suspensionId_fkey'
  ) THEN
    ALTER TABLE "CourseClosureTracking"
      ADD CONSTRAINT "CourseClosureTracking_suspensionId_fkey"
      FOREIGN KEY ("suspensionId") REFERENCES "ElementSuspension"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── بلاغات العوائق ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ElementBlocker" (
  "id"             UUID NOT NULL,
  "trackingId"     UUID NOT NULL,
  "courseId"       UUID NOT NULL,
  "raisedById"     UUID NOT NULL,
  "reason"         "BlockerReason" NOT NULL,
  "awaitedParty"   TEXT NOT NULL,
  "details"        TEXT NOT NULL,
  "raisedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"     TIMESTAMP(3),
  "status"         "BlockerStatus" NOT NULL DEFAULT 'OPEN',
  "isCredited"     BOOLEAN NOT NULL DEFAULT true,
  "credit"         "BlockerCredit" NOT NULL DEFAULT 'AUTO_APPROVED',
  "quarterKey"     TEXT NOT NULL,
  "decidedById"    UUID,
  "decidedAt"      TIMESTAMP(3),
  "decisionNote"   TEXT,
  "lastNotifiedAt" TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ElementBlocker_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ElementBlocker_trackingId_idx" ON "ElementBlocker"("trackingId");
CREATE INDEX IF NOT EXISTS "ElementBlocker_courseId_idx"   ON "ElementBlocker"("courseId");
CREATE INDEX IF NOT EXISTS "ElementBlocker_raisedById_quarterKey_idx"
  ON "ElementBlocker"("raisedById", "quarterKey");
CREATE INDEX IF NOT EXISTS "ElementBlocker_status_idx"        ON "ElementBlocker"("status");
CREATE INDEX IF NOT EXISTS "ElementBlocker_reason_status_idx" ON "ElementBlocker"("reason", "status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementBlocker_trackingId_fkey'
  ) THEN
    ALTER TABLE "ElementBlocker"
      ADD CONSTRAINT "ElementBlocker_trackingId_fkey"
      FOREIGN KEY ("trackingId") REFERENCES "CourseClosureTracking"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementBlocker_courseId_fkey'
  ) THEN
    ALTER TABLE "ElementBlocker"
      ADD CONSTRAINT "ElementBlocker_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementBlocker_raisedById_fkey'
  ) THEN
    ALTER TABLE "ElementBlocker"
      ADD CONSTRAINT "ElementBlocker_raisedById_fkey"
      FOREIGN KEY ("raisedById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ElementBlocker_decidedById_fkey'
  ) THEN
    ALTER TABLE "ElementBlocker"
      ADD CONSTRAINT "ElementBlocker_decidedById_fkey"
      FOREIGN KEY ("decidedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── الإدخال المتأخر للدورة ──────────────────────────────────
-- كلها اختيارية، والدورات القائمة تبقى بلا تأخير مسجّل عليها.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "isLateEntry"           BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryHours"        INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryReason"       TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryStatus"       "LateEntryStatus";
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryDecidedById"  UUID;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryDecidedAt"    TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "lateEntryDecisionNote" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "entryBaselineAt"       TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Course_isLateEntry_lateEntryStatus_idx"
  ON "Course"("isLateEntry", "lateEntryStatus");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Course_lateEntryDecidedById_fkey'
  ) THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_lateEntryDecidedById_fkey"
      FOREIGN KEY ("lateEntryDecidedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── إعدادات المنصة الجديدة ──────────────────────────────────
-- تُدرج هنا حتى لا يحتاج أحد تشغيل أمر بذرة بعد الرفع.
INSERT INTO "AppSetting" ("key", "value", "category", "label", "createdAt", "updatedAt")
VALUES
  ('blockers.quarterQuota',   '3', 'blockers', 'رصيد المنسق من بلاغات العوائق في الفصل', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('blockers.partyDirectory', '',  'blockers', 'عناوين الجهات المنتظَرة (سطر لكل جهة: الاسم = البريد)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('course.entryLeadHours',   '72','courses',  'المهلة المطلوبة لإدخال الدورة قبل بدايتها (ساعة)', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- ── المهمة المجدولة: القائمة الأسبوعية ──────────────────────
-- تعمل كل ١٦٨ ساعة، ومعطّلة ابتداءً (PAUSED) حتى تُدرج عناوين
-- الجهات في الإعداد أعلاه — فلا يُرسل بريد قبل أن تُراجعه الإدارة.
INSERT INTO "ScheduledJob" ("id", "name", "type", "status", "intervalHours", "payload", "nextRunAt", "createdAt", "updatedAt")
SELECT
  -- معرّف ثابت: لا يعتمد على امتداد توليد المعرّفات في الخادم
  'a7f3c1d2-9b64-4e08-8c15-5e0b10c4e7a1'::UUID,
  'القائمة الأسبوعية للجهات المتأخرة',
  'CUSTOM',
  'PAUSED',
  168,
  '{"handler":"BLOCKER_WEEKLY_LIST"}'::JSONB,
  CURRENT_TIMESTAMP + INTERVAL '7 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ScheduledJob" WHERE "payload"->>'handler' = 'BLOCKER_WEEKLY_LIST'
);
