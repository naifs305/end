// PUT /api/motivation/ideas/[id] — تحديث الحالة (مدير) أو التأييد (support)
const { withAuth, withMethods, ok, fail } = require('../../../../lib/server/http');
const motivationService = require('../../../../lib/modules/motivation/motivation.service');

async function handler(req, res) {
  const { id } = req.query;
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    return ok(res, await motivationService.updateIdea(id, req.body || {}, actor));
  } catch (err) {
    return fail(res, err);
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
