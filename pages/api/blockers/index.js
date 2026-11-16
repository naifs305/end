// GET  /api/blockers — قائمة البلاغات بحسب الدور
// POST /api/blockers — رفع بلاغ عائق على عنصر
const { withMethods, withAuth, withValidation, ok, created, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/blockers/blockers.service');
const { raiseBlockerSchema } = require('../../../lib/modules/blockers/blockers.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = await svc.listBlockers(req.query || {}, req.user, req.activeRole);
      return ok(res, data);
    }

    return await withValidation(raiseBlockerSchema, (r, s) =>
      svc.raiseBlocker(r.valid, r.user, r.activeRole).then((x) => created(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
