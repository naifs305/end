const { withMethods, withAuth, withValidation, ok, created, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/courses/courses.service');
const { createCourseSchema } = require('../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { projectId, status, page, limit } = req.query;
      return ok(res, await svc.findAllCourses(req.user, req.activeRole, projectId, status, page, limit));
    }

    return await withValidation(createCourseSchema, (r, s) =>
      svc.createCourse(r.valid, r.user, r.activeRole).then((x) => created(s, x)))(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
