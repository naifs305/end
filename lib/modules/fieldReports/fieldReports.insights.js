// =============================================================
// ملاحظات ميدانية من تقارير الدورات
// -------------------------------------------------------------
// المنسقون يكتبون ملاحظاتهم الميدانية في تقريري الافتتاح والاختتام
// (بيئة التدريب، والمدربون، والمتدربون، والمحتوى، والمنصة، والخدمات
// المساندة، وجاهزية الافتتاح، والتوصيات). تُجمع هنا بمصدرها وكاتبها
// ودورتها، فيتعلّم منها الجميع كما يتعلّمون من التقارير الميدانية —
// بلا نسخ ولا نشر باسم أحد: تُقرأ من مصدرها وتتجدّد مع كل تقرير.
// =============================================================
const prisma = require('../../db/prisma');

const SECTIONS = {
  training_environment: 'بيئة التدريب والقاعة',
  trainer_evaluation: 'المدربون',
  trainee_evaluation: 'المتدربون',
  content_evaluation: 'المحتوى التدريبي',
  lms_evaluation: 'منصة التدريب',
  support_services_evaluation: 'الخدمات المساندة (الانتداب والسلفة والسفر)',
  readiness_notes: 'جاهزية الافتتاح',
  recommendations: 'التوصيات',
};

// التقدير ← نوع الملاحظة
const KIND_OF_RATING = {
  excellent: 'praise',
  good: 'note',
  needs_improvement: 'issue',
  requires_development: 'issue',
  weak: 'issue',
  not_applicable: 'note',
};
const KINDS = {
  issue: 'تحتاج معالجة',
  recommendation: 'توصية',
  note: 'ملاحظة',
  praise: 'إشادة',
};
const RATING_LABEL = {
  excellent: 'ممتاز', good: 'جيد', needs_improvement: 'يحتاج تحسين',
  requires_development: 'يحتاج تطوير', weak: 'ضعيف', not_applicable: 'لا ينطبق',
};

const MIN_LEN = 15;

/** يحوّل صفاً خاماً إلى ملاحظة — دالة صافية تُختبر وحدها */
function toInsight(r) {
  const text = String(r.text || '').replace(/\s+\n/g, '\n').trim();
  if (text.length < MIN_LEN || /^data:|^https?:\/\/\S+$/.test(text)) return null;
  const kind = r.section === 'recommendations' ? 'recommendation'
    : r.section === 'readiness_notes' ? 'note'
      : KIND_OF_RATING[r.rating] || 'note';
  return {
    id: `${r.trackingId}:${r.section}`,
    kind,
    kindLabel: KINDS[kind],
    section: r.section,
    sectionLabel: SECTIONS[r.section] || r.section,
    rating: r.rating || null,
    ratingLabel: RATING_LABEL[r.rating] || null,
    source: r.report === 'closing_report' ? 'تقرير الاختتام' : 'تقرير الافتتاح',
    text,
    at: r.at,
    course: { id: r.courseId, name: r.courseName, city: r.city || null },
    author: r.authorId ? { id: r.authorId, name: `${r.firstName || ''} ${r.lastName || ''}`.trim() } : null,
  };
}

async function findRaw() {
  // نصوص الملاحظات وحدها من بيانات التقرير (بلا الصور المرفقة الثقيلة)
  return prisma.$queryRawUnsafe(`
    SELECT t."id" AS "trackingId", e."key" AS "report", t."executionAt" AS "at",
           c."id" AS "courseId", c."name" AS "courseName", c."city" AS "city",
           u."id" AS "authorId", u."firstName" AS "firstName", u."lastName" AS "lastName",
           s.key AS "section",
           CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value->>'rating' END AS "rating",
           CASE WHEN jsonb_typeof(s.value) = 'object' THEN s.value->>'comment' ELSE s.value #>> '{}' END AS "text"
      FROM "CourseClosureTracking" t
      JOIN "ClosureElement" e ON e."id" = t."elementId"
      JOIN "Course" c ON c."id" = t."courseId"
      LEFT JOIN "User" u ON u."id" = COALESCE(t."executedById", c."primaryEmployeeId")
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(t."formData"::jsonb) = 'object' THEN t."formData"::jsonb ELSE '{}'::jsonb END
      ) s
     WHERE e."key" IN ('opening_report', 'closing_report')
       AND t."status" IN ('PENDING_APPROVAL', 'APPROVED')
       AND (
         (jsonb_typeof(s.value) = 'object' AND length(coalesce(s.value->>'comment', '')) >= ${MIN_LEN})
         OR (s.key IN ('readiness_notes', 'recommendations') AND jsonb_typeof(s.value) = 'string' AND length(s.value #>> '{}') >= ${MIN_LEN})
       )
     ORDER BY t."executionAt" DESC NULLS LAST
     LIMIT 2000`);
}

/** الملاحظات مع عدّاداتها، والإشادات خلف خيار (التعلّم من المشكلات أولاً) */
async function list({ kind, section, q } = {}) {
  const all = (await findRaw()).map(toInsight).filter(Boolean);
  const counts = { total: all.length, byKind: {}, bySection: {} };
  for (const i of all) {
    counts.byKind[i.kind] = (counts.byKind[i.kind] || 0) + 1;
    counts.bySection[i.section] = (counts.bySection[i.section] || 0) + 1;
  }
  const needle = String(q || '').trim();
  const items = all.filter((i) => (!kind || i.kind === kind)
    && (!section || i.section === section)
    && (!needle || i.text.includes(needle) || i.course.name?.includes(needle) || i.author?.name.includes(needle)));
  return { items: items.slice(0, 400), matched: items.length, counts, sections: SECTIONS, kinds: KINDS };
}

module.exports = { list, toInsight, SECTIONS, KINDS };
