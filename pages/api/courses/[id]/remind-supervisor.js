// POST /api/courses/[id]/remind-supervisor — المنسق يذكّر مشرف دورته بما ينتظر اعتماده
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/reminders/reminders.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.remindSupervisor(req.query.id, req.user, req.activeRole));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
