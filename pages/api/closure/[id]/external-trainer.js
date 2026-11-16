// /api/closure/[id]/external-trainer — عنصر «مدرب خارجي»
//   GET                 بيانات المدرب وسجل الرسائل المُخرجة
//   GET ?output=hr|protocol|hospitality   رسالة البريد جاهزة (EML)
//   PUT { ...trainer }  حفظ بيانات المدرب والتذاكر المصدرة
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/externalTrainer/externalTrainer.service');
const { sanitizeFilename } = require('../../../../lib/email/eml');

async function handler(req, res) {
  const actor = [req.user, req.activeRole];
  try {
    if (req.method === 'PUT') return ok(res, await svc.save(req.query.id, req.body || {}, ...actor));
    if (req.query.output) {
      const { eml, prefix, courseName } = await svc.email(req.query.id, String(req.query.output), ...actor);
      res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${sanitizeFilename(courseName || 'course', 'course')}.eml"`);
      return res.status(200).send(eml);
    }
    return ok(res, await svc.get(req.query.id, ...actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
