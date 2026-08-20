// POST /api/courses/[id]/notes-report
// إنشاء وأرشفة تقرير ملاحظات ميداني جديد (سجل غير قابل للتعديل بعد الإرسال)
const { withMethods, withAuth, withValidation, created, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/courses/courses.service');
const { notesReportSchema } = require('../../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  const { id } = req.query;
  try {
    return await withValidation(notesReportSchema, (r, s) =>
      svc.createNotesReport(id, r.valid, r.user, r.activeRole).then((x) => created(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};
