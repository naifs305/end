-- =============================================================
-- المنسق المتعاون
-- -------------------------------------------------------------
-- منسق من خارج موظفي العمليات لا ينتمي لمشروع، ومرجعه المدير،
-- ويسند المدير متابعته لأي مشرف مشروع.
--
-- آمن لإعادة التشغيل، ولا يحذف بياناً ولا يغيّر قيمة قائمة:
-- المشروع يصير اختيارياً (كل موظف قائم يبقى في مشروعه)، والحقلان
-- الجديدان فارغان ابتداءً.
-- نوع عمود المشرف المتابع يؤخذ من معرّف المستخدم وقت التطبيق
-- (UUID في قاعدة فيرسل، ونصّي في قاعدة خادم الجامعة).
-- =============================================================

ALTER TABLE "User" ALTER COLUMN "operationalProjectId" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isCollaborator" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  EXECUTE format('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "followUpSupervisorId" %s',
    (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
      WHERE attrelid = '"User"'::regclass AND attname = 'id'));
END $$;

CREATE INDEX IF NOT EXISTS "User_followUpSupervisorId_idx" ON "User"("followUpSupervisorId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_followUpSupervisorId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_followUpSupervisorId_fkey"
      FOREIGN KEY ("followUpSupervisorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
