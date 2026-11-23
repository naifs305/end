-- =============================================================
-- المجالات التدريبية للمشاريع + التوزيع الجديد للمشاريع التشغيلية
-- -------------------------------------------------------------
-- ١. جدول المجالات: كل مجال يتبع مشروعاً واحداً، ويديرها المدير من
--    صفحة المشاريع (إضافة وتسمية ونقل وحذف).
-- ٢. التوزيع الجديد (نوفمبر ٢٠٢٦):
--    مشروع السلامة العامة   — وليد السليم
--      مزنة آل محمود، يعقوب الشمري، نواف المحارب
--      أمن الطيران، اللغة الإنجليزية، الأمن والسلامة العامة
--    مشروع الأمن والحدود    — بشاير الطحيني
--      فؤاد نعمان، عبدالحميد القحطاني
--      مكافحة الفساد والجرائم المالية، عمليات إنفاذ القانون، أمن الحدود،
--      الجريمة المنظمة، التحقيق والأدلة الجنائية
--    مشروع التهديدات الحديثة — خازم الأسمري
--      ثامر العاصمي، عبدالمحسن العنزي
--      مكافحة الإرهاب، القيادة والإدارة الأمنية المستقبلية،
--      الجرائم السيبرانية، الأمن البيئي
--
-- يُعثر على المشروع باسمه الجديد، وإلا بمشرفه، وإلا باسمه القديم؛
-- فيُعاد تسميته لا إنشاؤه، وتبقى دوراته وسجلّه كما هي. ولا يُنشأ
-- مشروع جديد إلا إن لم يوجد شيء من ذلك.
-- ويُطابَق الموظف باسمه بعد توحيد الهمزات والمسافات (آل = ال).
-- من لا يوجد في القاعدة يُتجاوز بلا خطأ.
--
-- آمن لإعادة التشغيل. والأنواع تؤخذ من الجداول نفسها: المعرّفات
-- UUID في قاعدة فيرسل ونصّية في قاعدة خادم الجامعة.
-- =============================================================

DO $$
DECLARE
  t_proj text := (SELECT format_type(atttypid, atttypmod) FROM pg_attribute
                   WHERE attrelid = '"OperationalProject"'::regclass AND attname = 'id');
BEGIN
  EXECUTE format($sql$
    CREATE TABLE IF NOT EXISTS "ProjectDomain" (
      "id"                   TEXT NOT NULL,
      "name"                 TEXT NOT NULL,
      "operationalProjectId" %1$s NOT NULL,
      "sortOrder"            INTEGER NOT NULL DEFAULT 0,
      "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProjectDomain_pkey" PRIMARY KEY ("id")
    )
  $sql$, t_proj);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectDomain_name_key" ON "ProjectDomain"("name");
CREATE INDEX IF NOT EXISTS "ProjectDomain_operationalProjectId_idx" ON "ProjectDomain"("operationalProjectId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectDomain_operationalProjectId_fkey') THEN
    ALTER TABLE "ProjectDomain"
      ADD CONSTRAINT "ProjectDomain_operationalProjectId_fkey"
      FOREIGN KEY ("operationalProjectId") REFERENCES "OperationalProject"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── التوزيع الجديد ──────────────────────────────────────────
DO $$
DECLARE
  plan jsonb := '[
    {"name": "مشروع السلامة العامة", "old": "مشروع القيادة الأمنية",
     "supervisor": "وليد السليم",
     "coordinators": ["مزنة آل محمود", "يعقوب الشمري", "نواف المحارب"],
     "domains": ["أمن الطيران", "اللغة الإنجليزية", "الأمن والسلامة العامة"]},
    {"name": "مشروع الأمن والحدود", "old": "مشروع الوقاية الأمنية",
     "supervisor": "بشاير الطحيني",
     "coordinators": ["فؤاد نعمان", "عبدالحميد القحطاني"],
     "domains": ["مكافحة الفساد والجرائم المالية", "عمليات إنفاذ القانون", "أمن الحدود", "الجريمة المنظمة", "التحقيق والأدلة الجنائية"]},
    {"name": "مشروع التهديدات الحديثة", "old": "مشروع التهديدات الحديثة",
     "supervisor": "خازم الأسمري",
     "coordinators": ["ثامر العاصمي", "عبدالمحسن العنزي"],
     "domains": ["مكافحة الإرهاب", "القيادة والإدارة الأمنية المستقبلية", "الجرائم السيبرانية", "الأمن البيئي"]}
  ]'::jsonb;
  p jsonb;
  pid text;
  sup_key text;
  person text;
  dom text;
  i int;
BEGIN
  FOR p IN SELECT * FROM jsonb_array_elements(plan) LOOP
    sup_key := regexp_replace(translate(replace(p->>'supervisor', 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g');

    -- المشروع: باسمه الجديد، أو بمشرفه، أو باسمه القديم
    SELECT id::text INTO pid FROM "OperationalProject" WHERE name = p->>'name';
    IF pid IS NULL THEN
      SELECT ps."operationalProjectId"::text INTO pid
        FROM "ProjectSupervisor" ps JOIN "User" u ON u.id = ps."userId"
       WHERE regexp_replace(translate(replace(u."firstName" || u."lastName", 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g') = sup_key
       LIMIT 1;
    END IF;
    IF pid IS NULL THEN
      SELECT id::text INTO pid FROM "OperationalProject" WHERE name = p->>'old';
    END IF;
    IF pid IS NULL THEN
      INSERT INTO "OperationalProject" (id, name) VALUES (gen_random_uuid(), p->>'name');
      SELECT id::text INTO pid FROM "OperationalProject" WHERE name = p->>'name';
    ELSE
      UPDATE "OperationalProject" SET name = p->>'name' WHERE id::text = pid AND name <> p->>'name';
    END IF;

    -- المشرف: يشرف على هذا المشروع وحده، ومشروعه هو
    UPDATE "User" SET roles = array_append(roles, 'PROJECT_SUPERVISOR')
     WHERE regexp_replace(translate(replace("firstName" || "lastName", 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g') = sup_key
       AND NOT ('PROJECT_SUPERVISOR' = ANY(roles));
    INSERT INTO "ProjectSupervisor" (id, "userId", "operationalProjectId", "createdAt")
      SELECT gen_random_uuid(), u.id, op.id, CURRENT_TIMESTAMP
        FROM "User" u, "OperationalProject" op
       WHERE op.id::text = pid
         AND regexp_replace(translate(replace(u."firstName" || u."lastName", 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g') = sup_key
      ON CONFLICT ("userId") DO UPDATE SET "operationalProjectId" = EXCLUDED."operationalProjectId";
    UPDATE "User" SET "operationalProjectId" = op.id, "isCollaborator" = false, "followUpSupervisorId" = NULL
      FROM "OperationalProject" op
     WHERE op.id::text = pid
       AND regexp_replace(translate(replace("User"."firstName" || "User"."lastName", 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g') = sup_key;

    -- المنسقون: ينتقلون إلى المشروع (ودوراتهم القائمة تبقى في مشاريعها)
    FOR person IN SELECT * FROM jsonb_array_elements_text(p->'coordinators') LOOP
      UPDATE "User" SET "operationalProjectId" = op.id, "isCollaborator" = false, "followUpSupervisorId" = NULL
        FROM "OperationalProject" op
       WHERE op.id::text = pid
         AND regexp_replace(translate(replace("User"."firstName" || "User"."lastName", 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g')
           = regexp_replace(translate(replace(person, 'آل', 'ال'), 'أإآة', 'اااه'), '\s', '', 'g');
    END LOOP;

    -- المجالات: تُضاف للمشروع، والمجال القائم يُنقل إليه
    i := 0;
    FOR dom IN SELECT * FROM jsonb_array_elements_text(p->'domains') LOOP
      i := i + 1;
      INSERT INTO "ProjectDomain" (id, name, "operationalProjectId", "sortOrder")
        SELECT gen_random_uuid(), dom, op.id, i FROM "OperationalProject" op WHERE op.id::text = pid
        ON CONFLICT (name) DO UPDATE SET "operationalProjectId" = EXCLUDED."operationalProjectId", "sortOrder" = EXCLUDED."sortOrder";
    END LOOP;

    pid := NULL;
  END LOOP;
END $$;
