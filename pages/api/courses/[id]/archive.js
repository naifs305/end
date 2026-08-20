const { withMethods, withManagerOrSupervisor, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');

async function handler(req, res) {
  try {
    return ok(res, await svc.archiveCourse(req.query.id, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
