// POST /api/courses/[id]/toggle-report
// { type: 'opening' | 'closing', enabled: boolean }
// مشرف المشروع أو المدير يفعّل/يعطّل تقرير على دورة قائمة
const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');
const { toggleReportSchema } = require('../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  try {
    return await withValidation(toggleReportSchema, (r, s) =>
      svc.toggleReport(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
