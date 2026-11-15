-- عنصر «مدرب خارجي» — اختياري يفعّله المنسق من صفحة الدورة حين يكون المدرب من الخارج.
-- يُخرج ثلاث رسائل: تذاكر السفر (الموارد البشرية)، والاستقبال والتوديع (المراسم)،
-- والإسكان والضيافة. لا يمسّ بيانات قائمة، وآمن للتكرار، ويصلح لقاعدتي المعرّفات.

-- (١) العنصر: موعده قبل بداية الدورة (تذاكر وإسكان تحتاج مهلة)
INSERT INTO "ClosureElement" (
  "id", "key", "name", "isFormBased",
  "deadlineRefPoint", "deadlineIdealHours", "deadlineMaxHours", "isDeadlineWorkingDays",
  "elementType", "conditionField", "isActive", "isCustom"
)
SELECT 'b1c2d3e4-0005-4a1b-9c2d-3e4f50617285', 'external_trainer', 'مدرب خارجي', true,
       'START', -240, -120, true,
       'OPTIONAL', NULL, true, false
WHERE NOT EXISTS (SELECT 1 FROM "ClosureElement" WHERE "key" = 'external_trainer');

-- (٢) يُضاف للدورات القائمة غير المقفلة «غير مفعّل» — يفعّله المنسق عند الحاجة
INSERT INTO "CourseClosureTracking" ("id", "courseId", "elementId", "status")
SELECT gen_random_uuid(), c."id", e."id", 'NOT_APPLICABLE'::"ElementStatus"
  FROM "Course" c
 CROSS JOIN "ClosureElement" e
 WHERE e."key" = 'external_trainer'
   AND c."status" NOT IN ('CLOSED', 'ARCHIVED')
   AND NOT EXISTS (
     SELECT 1 FROM "CourseClosureTracking" t
      WHERE t."courseId" = c."id" AND t."elementId" = e."id"
   );

-- (٣) عناوين الرسائل — تُعدَّل من «إعدادات التشغيل» دون تعديل كود
INSERT INTO "AppSetting" ("key", "value", "category", "label", "createdAt", "updatedAt")
VALUES
  ('trainer.hr.email.to', 'hr@nauss.edu.sa', 'email', 'المدرب الخارجي: الموارد البشرية (التذاكر) — المستلم', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('trainer.hr.email.cc', 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlgunian@nauss.edu.sa', 'email', 'المدرب الخارجي: الموارد البشرية (التذاكر) — نسخة إلى', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('trainer.protocol.email.to', 'PRM@nauss.edu.sa', 'email', 'المدرب الخارجي: المراسم (الاستقبال والتوديع) — المستلم', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('trainer.protocol.email.cc', 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, AAlshehri6@nauss.edu.sa', 'email', 'المدرب الخارجي: المراسم (الاستقبال والتوديع) — نسخة إلى', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('trainer.hospitality.email.to', 'Hospitality@nauss.edu.sa', 'email', 'المدرب الخارجي: الضيافة والإسكان — المستلم', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('trainer.hospitality.email.cc', 'od@nauss.edu.sa, NAlshahrani@nauss.edu.sa, SKAlanazi@nauss.edu.sa', 'email', 'المدرب الخارجي: الضيافة والإسكان — نسخة إلى', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
