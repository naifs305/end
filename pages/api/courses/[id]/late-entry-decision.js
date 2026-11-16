// POST /api/courses/[id]/late-entry-decision — قبول مبرر التأخير أو رفضه
const { withMethods, withManager, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');

async function handler(req, res) {
  try {
    const { accept, note } = req.body || {};
    const result = await svc.decideLateEntry(req.query.id, { accept: !!accept, note }, req.user, req.activeRole);
    return ok(res, result);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
