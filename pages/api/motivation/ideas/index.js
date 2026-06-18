// GET /api/motivation/ideas  — قائمة المبادرات
// POST /api/motivation/ideas — إضافة مبادرة
const { withAuth, withMethods, ok, created, fail } = require('../../../../lib/server/http');
const motivationService = require('../../../../lib/modules/motivation/motivation.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'GET') {
      return ok(res, await motivationService.listIdeas({ status: req.query.status, mine: req.query.mine }, actor));
    }
    return created(res, await motivationService.createIdea(req.body || {}, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
