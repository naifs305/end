// GET/POST /api/courses
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const coursesService = require('../../../lib/services/courses');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { projectId, status } = req.query;
      const courses = await coursesService.findAllCourses(req.user, req.activeRole, projectId, status);
      return res.status(200).json(courses);
    }

    if (req.method === 'POST') {
      const course = await coursesService.createCourse(req.body, req.user, req.activeRole);
      return res.status(201).json(course);
    }
  } catch (err) {
    console.error('خطأ في الدورات:', err);
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withAuth(handler));
module.exports.default = module.exports;
