// GET  /api/courses/[id]/optional-reports  → قائمة التقارير الاختيارية
// POST /api/courses/[id]/optional-reports  → إضافة تقرير جديد
const { withAuth, withValidation, ok, created, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');
const { optionalReportSchema } = require('../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      return ok(res, await svc.listOptionalReports(id));
    }

    if (req.method === 'POST') {
      return await withValidation(optionalReportSchema, (r, s) =>
        svc.createOptionalReport(id, r.valid, r.user, r.activeRole).then((x) => created(s, x)))(req, res);
    }

    return res.status(405).json({ message: 'Method Not Allowed', code: 'serverErrors.common.methodNotAllowed' });
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withAuth(handler);
module.exports.default = module.exports;
