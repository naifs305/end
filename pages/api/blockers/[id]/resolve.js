// POST /api/blockers/[id]/resolve
const { withMethods, withAuth, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/blockers/blockers.service');
const { resolveBlockerSchema } = require('../../../../lib/modules/blockers/blockers.schema');

async function handler(req, res) {
  try {
    return await withValidation(resolveBlockerSchema, (r, s) =>
      svc.resolveBlocker(r.query.id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
