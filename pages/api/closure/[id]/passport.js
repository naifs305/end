// POST /api/closure/[id]/passport — قراءة بيانات المدرب الخارجي من جواز سفره
//   { file: 'data:image/jpeg;base64,…' | 'data:application/pdf;base64,…' }
// يعيد الحقول المستخرجة ونتيجة التحقق ليراجعها المنسق؛ الصورة لا تُحفظ.
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/externalTrainer/externalTrainer.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.readPassport(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { bodyParser: { sizeLimit: '12mb' } }, maxDuration: 120 };
