// POST /api/courses/[id]/override-element
// { trackingId, action: 'revert' | 'exempt' | 'restore', reason }
// تحكم المدير في عناصر الإقفال:
//  - revert : إرجاع عنصر مُعتمد (APPROVED) إلى "لم يبدأ" مع سبب (إلزامي)
//  - exempt : وضع عنصر كاستثناء "غير منطبق" مع سبب (إلزامي)
//  - restore: إلغاء استثناء عنصر مُستثنى وإرجاعه إلى "لم يبدأ"
const { withMethods, withManager, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');
const { overrideElementSchema } = require('../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  try {
    return await withValidation(overrideElementSchema, (r, s) =>
      svc.overrideElement(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
