const { withManagerOrSupervisor, withMethods } = require('../../../../lib/middleware/auth');
const coursesService = require('../../../../lib/services/courses');

async function handler(req, res) {
  try {
    return res.status(200).json(await coursesService.archiveCourse(req.query.id, req.user, req.activeRole));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
