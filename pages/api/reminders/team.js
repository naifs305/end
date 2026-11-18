// GET  /api/reminders/team — منسقو الفريق وعناصرهم المعلّقة
// POST /api/reminders/team { userId?, note } — تذكير منسق واحد أو الفريق كله
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/reminders/reminders.service');

async function handler(req, res) {
  try {
    if (req.method === 'GET') return ok(res, await svc.previewTeam(req.user, req.activeRole));
    return ok(res, await svc.remindTeam(req.body || {}, req.user, req.activeRole));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
