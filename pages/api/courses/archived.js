// GET /api/courses/archived
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const coursesService = require('../../../lib/services/courses');

async function handler(req, res) {
  const { search } = req.query;
  const courses = await coursesService.findArchivedCourses(search, req.user, req.activeRole);
  return res.status(200).json(courses);
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
