// /api/closure/[id]/cert-review-file — الشهادات المرفقة للمراجعة
//   GET    ?key=…              عرض الملف (للمراجِع ومن يرى الدورة)
//   POST   { name, dataUrl }   رفع ملف (منسق الدورة وفريقها) — PDF أو صورة حتى ٨ ميجابايت
//   DELETE ?key=…              حذف ملف قبل التأكيد
// وتُحذف كل الملفات تلقائياً بعد أن يؤكد المراجِع سلامة الشهادات.
const { withMethods, withAuth, ok, created, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/certReview/certReview.service');
const store = require('../../../../lib/storage/mediaStore');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const f = await svc.fileForDownload(req.query.id, String(req.query.key || ''), req.user, req.activeRole);
      res.setHeader('Content-Type', f.type);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return store.readStream(f.key).on('error', () => res.status(404).end()).pipe(res);
    }
    if (req.method === 'DELETE') return ok(res, await svc.removeFile(req.query.id, String(req.query.key || ''), req.user, req.activeRole));
    return created(res, await svc.addFile(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = { api: { bodyParser: { sizeLimit: '12mb' } } };
