// /api/closure/[id]/cert-review — مراجعة الشهادات بعين ثانية
//   GET                                   حالة المراجعة والمراجِعون المتاحون
//   POST { action:'assign', reviewerId, link?, note? }   إسناد المراجعة أو إعادة إرسالها
//   POST { action:'respond', decision:'confirm'|'return', note? }   رد المراجِع
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/certReview/certReview.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') return ok(res, await svc.get(req.query.id, req.user, req.activeRole));
    const body = req.body || {};
    if (body.action === 'assign') return ok(res, await svc.assign(req.query.id, body, req.user, req.activeRole));
    if (body.action === 'respond') return ok(res, await svc.respond(req.query.id, body, req.user));
    return res.status(400).json({ message: 'طلب غير معروف' });
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
