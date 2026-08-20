// GET /api/motivation/challenges  — التحدي الحالي
// POST /api/motivation/challenges — إنشاء تحدي جديد (مدير)
const { withAuth, withMethods, ok, created, fail } = require('../../../../lib/server/http');
const motivationService = require('../../../../lib/modules/motivation/motivation.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'GET') {
      return ok(res, await motivationService.getChallenge({ periodLabel: req.query.periodLabel }));
    }
    return created(res, await motivationService.createChallenge(req.body || {}, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
