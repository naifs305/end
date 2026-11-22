// GET  /api/courses/[id]/remind-coordinator — معاينة العناصر المعلّقة
// POST /api/courses/[id]/remind-coordinator { note } — المشرف/المدير يذكّر منسق الدورة
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/reminders/reminders.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') return ok(res, await svc.previewCourse(req.query.id, req.user, req.activeRole));
    return ok(res, await svc.remindCourse(req.query.id, req.body || {}, req.user, req.activeRole));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
