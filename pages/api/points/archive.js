// POST /api/points/archive { year } — حفظ رصيد سنة منقضية كما هو (المدير)
const { withMethods, withManager, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/points/points.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.archiveYear(Number(req.body?.year), req.user));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
