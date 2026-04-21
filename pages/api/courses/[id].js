const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const coursesService = require('../../../lib/services/courses');

async function handler(req, res) {
  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      return res.status(200).json(await coursesService.findOneCourse(id, req.user, req.activeRole));
    }

    if (req.method === 'PUT') {
      return res.status(200).json(await coursesService.updateCourse(id, req.body || {}, req.user, req.activeRole));
    }

    return res.status(200).json(await coursesService.deleteCourse(id, req.user, req.activeRole));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['GET', 'PUT', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
