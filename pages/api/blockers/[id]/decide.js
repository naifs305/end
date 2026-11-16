// POST /api/blockers/[id]/decide — قرار المدير في بلاغ تجاوز الرصيد الفصلي
const { withMethods, withManager, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/blockers/blockers.service');
const { decideBlockerSchema } = require('../../../../lib/modules/blockers/blockers.schema');

async function handler(req, res) {
  try {
    return await withValidation(decideBlockerSchema, (r, s) =>
      svc.decideBlocker(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
