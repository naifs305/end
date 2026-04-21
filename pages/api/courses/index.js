const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const coursesService = require('../../../lib/services/courses');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { projectId, status } = req.query;
      return res.status(200).json(await coursesService.findAllCourses(req.user, req.activeRole, projectId, status));
    }

    return res.status(201).json(await coursesService.createCourse(req.body || {}, req.user, req.activeRole));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
