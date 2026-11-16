-- =============================================================
-- سجل المترجمين
-- -------------------------------------------------------------
-- قاعدة واحدة للمترجمين يختار منها المنسق بدل إعادة إدخال
-- البيانات في كل دورة، ويديرها المدير من صفحة «المترجمون».
-- وبيانات مترجم الدورة تبقى نسختها الخاصة، وتُربط بالسجل.
--
-- آمن لإعادة التشغيل، ولا يحذف بياناً ولا يغيّر قيمة قائمة.
--
-- الأنواع: معرّفات الجداول الأساسية UUID في قاعدة فيرسل ونصّية
-- في قاعدة خادم الجامعة، والربط يشترط تطابق النوعين — فيأخذ كل
-- عمود هنا نوعه من الجدول الذي يشير إليه وقت التطبيق.
--
-- ولا تُدرج هنا بيانات مترجمين: فيها هويات وحسابات بنكية لا
-- تُحفظ في ملفات المستودع. تُضاف من الصفحة أو باستيراد ملفها.
-- =============================================================

DO $$
DECLARE
  t_user text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                   WHERE attrelid = '"User"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "Interpreter" (
      "id"          %1$s NOT NULL,
      "fullName"    TEXT NOT NULL,
      "nationalId"  TEXT NOT NULL,
      "nationality" TEXT,
      "email"       TEXT NOT NULL,
      "mobile"      TEXT NOT NULL,
      "address"     TEXT NOT NULL,
      "specialty"   TEXT,
      "bankName"    TEXT,
      "bankBranch"  TEXT,
      "bankCountry" TEXT,
      "iban"        TEXT,
      "notes"       TEXT,
      "createdById" %1$s,
      "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Interpreter_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_user);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Interpreter_nationalId_key" ON "Interpreter"("nationalId");
CREATE INDEX IF NOT EXISTS "Interpreter_fullName_idx" ON "Interpreter"("fullName");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Interpreter_createdById_fkey') THEN
    ALTER TABLE "Interpreter"
      ADD CONSTRAINT "Interpreter_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ربط مترجم الدورة بالسجل ─────────────────────────────────
DO $$ BEGIN
  EXECUTE format('ALTER TABLE "CourseInterpreter" ADD COLUMN IF NOT EXISTS "interpreterId" %s',
    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = '"Interpreter"'::regclass AND attname = 'id'));
END $$;

CREATE INDEX IF NOT EXISTS "CourseInterpreter_interpreterId_idx" ON "CourseInterpreter"("interpreterId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CourseInterpreter_interpreterId_fkey') THEN
    ALTER TABLE "CourseInterpreter"
      ADD CONSTRAINT "CourseInterpreter_interpreterId_fkey"
      FOREIGN KEY ("interpreterId") REFERENCES "Interpreter"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── المترجمون المسجّلون في دورات سابقة يدخلون السجل ─────────
-- من كل هوية أحدث ما أُدخل لها، فلا يبدأ السجل فارغاً.
INSERT INTO "Interpreter" ("id", "fullName", "nationalId", "nationality", "email", "mobile", "address",
                           "bankName", "bankBranch", "bankCountry", "iban", "createdById", "createdAt", "updatedAt")
SELECT DISTINCT ON (ci."nationalId")
       ci."id", ci."fullName", ci."nationalId", ci."nationality", ci."email", ci."mobile", ci."address",
       ci."bankName", ci."bankBranch", ci."bankCountry", ci."iban", ci."createdById", ci."createdAt", CURRENT_TIMESTAMP
  FROM "CourseInterpreter" ci
 WHERE NOT EXISTS (SELECT 1 FROM "Interpreter" i WHERE i."nationalId" = ci."nationalId")
 ORDER BY ci."nationalId", ci."updatedAt" DESC;

UPDATE "CourseInterpreter" ci
   SET "interpreterId" = i."id"
  FROM "Interpreter" i
 WHERE ci."interpreterId" IS NULL AND i."nationalId" = ci."nationalId";
