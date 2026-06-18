// GET /api/courses/archived
const { withMethods, withAuth, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/courses/courses.service');

async function handler(req, res) {
  try {
    const { search } = req.query;
    return ok(res, await svc.findArchivedCourses(search, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
