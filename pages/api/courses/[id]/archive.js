// PUT /api/courses/[id]/archive
const { withManagerOrSupervisor, withMethods } = require('../../../../lib/middleware/auth');
const coursesService = require('../../../../lib/services/courses');

async function handler(req, res) {
  const { id } = req.query;
  try {
    const course = await coursesService.archiveCourse(id, req.user, req.activeRole);
    return res.status(200).json(course);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
