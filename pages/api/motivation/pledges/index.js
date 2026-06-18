// GET /api/motivation/pledges  — تعهد المستخدم الحالي
// POST /api/motivation/pledges — حفظ تعهد جديد
const { withAuth, withMethods, ok, created, fail } = require('../../../../lib/server/http');
const motivationService = require('../../../../lib/modules/motivation/motivation.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'GET') {
      return ok(res, await motivationService.getPledge({ periodLabel: req.query.periodLabel, userId: req.query.userId }, actor));
    }
    return created(res, await motivationService.savePledge(req.body || {}, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
