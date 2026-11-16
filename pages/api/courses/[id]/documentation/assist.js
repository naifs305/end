// POST /api/courses/[id]/documentation/assist — مساعد التوثيق
//   { action: 'schedule', text }            لصق الجدول المنسوخ من منصة التدريب
//   { action: 'describe', sessions, indexes, intro }  أوصاف الجلسات بالذكاء الاصطناعي
//   { action: 'report', pdf }               قراءة تقرير الجهة المنفّذة (PDF)
// يعيد اقتراحاً يراجعه المنسق ثم يحفظه؛ لا يحفظ شيئاً بنفسه.
const { withMethods, withAuth, ok, fail } = require('../../../../../lib/server/http');
const svc = require('../../../../../lib/modules/documentation/documentation.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.assist(req.query.id, req.body || {}, { user: req.user, activeRole: req.activeRole }));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { bodyParser: { sizeLimit: '21mb' } }, maxDuration: 180 };
