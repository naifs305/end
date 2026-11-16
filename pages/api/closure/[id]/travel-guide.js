// /api/closure/[id]/travel-guide — عنصر «دليل السفر التعريفي»
//   GET                   بيانات الدليل
//   GET ?output=request   رسالة طلب تصميم دليل جديد لمدير الإدارة (EML)
//   PUT { mode, url, city, note }  حفظ
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/travelGuide/travelGuide.service');
const { sanitizeFilename } = require('../../../../lib/email/eml');

async function handler(req, res) {
  const actor = [req.user, req.activeRole];
  try {
    if (req.method === 'PUT') return ok(res, await svc.save(req.query.id, req.body || {}, ...actor));
    if (req.query.output === 'request') {
      const { eml, courseName } = await svc.requestEmail(req.query.id, ...actor);
      res.setHeader('Content-Type', 'message/rfc822; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="travel-guide-request-${sanitizeFilename(courseName || 'course', 'course')}.eml"`);
      return res.status(200).send(eml);
    }
    return ok(res, await svc.get(req.query.id, ...actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
