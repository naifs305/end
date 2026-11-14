// GET  /api/interpreters?search=  — سجل المترجمين (لمن ينفّذ ويعتمد)
// POST /api/interpreters          — إضافة مترجم (المدير)
const { withMethods, withAuth, ok, created, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/interpreters/interpreters.service');

async function handler(req, res) {
  const actor = { userId: req.user.id, activeRole: req.activeRole };
  try {
    if (req.method === 'POST') return created(res, await svc.create(req.body || {}, actor));
    return ok(res, await svc.list(req.query.search, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
