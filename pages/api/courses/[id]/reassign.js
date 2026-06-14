const { withManagerOrSupervisor, withMethods } = require('../../../../lib/middleware/auth');
const coursesService = require('../../../../lib/services/courses');

async function handler(req, res) {
  const { primaryEmployeeId } = req.body || {};

  if (!primaryEmployeeId) {
    return res.status(400).json({ message: 'معرف الموظف الجديد مطلوب' });
  }

  try {
    return res.status(200).json(await coursesService.reassignCourse(req.query.id, primaryEmployeeId, req.user, req.activeRole));
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
