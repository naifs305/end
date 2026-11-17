// GET /api/points/ledger/me?year=2026 — سجل الدرجات بأسبابها (me أو معرّف منسق)
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/points/points.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.ledger(String(req.query.userId), req.query, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
