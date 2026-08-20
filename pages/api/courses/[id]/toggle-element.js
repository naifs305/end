// POST /api/courses/[id]/toggle-element
// { trackingId, enabled }
// تفعيل/تعطيل عنصر اختياري (OPTIONAL) لهذه الدورة — للمنسق أو المشرف أو المدير
const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');
const { toggleElementSchema } = require('../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  try {
    return await withValidation(toggleElementSchema, (r, s) =>
      svc.toggleOptionalElement(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
