const { withMethods, withAuth, withValidation, ok, fail } = require('../../../lib/server/http');
const svc = require('../../../lib/modules/courses/courses.service');
const { updateCourseSchema } = require('../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      return ok(res, await svc.findOneCourse(id, req.user, req.activeRole));
    }

    if (req.method === 'PUT') {
      return await withValidation(updateCourseSchema, (r, s) =>
        svc.updateCourse(id, r.valid, r.user, r.activeRole).then((x) => ok(s, x)))(req, res);
    }

    return ok(res, await svc.deleteCourse(id, req.user, req.activeRole));
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
