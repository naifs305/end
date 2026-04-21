// GET/PUT/DELETE /api/courses/[id]
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const coursesService = require('../../../lib/services/courses');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      const course = await coursesService.findOneCourse(id, req.user, req.activeRole);
      return res.status(200).json(course);
    }

    if (req.method === 'PUT') {
      const updated = await coursesService.updateCourse(id, req.body, req.user, req.activeRole);
      return res.status(200).json(updated);
    }

    if (req.method === 'DELETE') {
      const result = await coursesService.deleteCourse(id, req.user, req.activeRole);
      return res.status(200).json(result);
    }
  } catch (err) {
    console.error('خطأ في دورة:', err);
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
