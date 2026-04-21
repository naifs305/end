// PUT /api/courses/[id]/reassign
const { withManagerOrSupervisor, withMethods } = require('../../../../lib/middleware/auth');
const coursesService = require('../../../../lib/services/courses');

async function handler(req, res) {
  const { id } = req.query;
  const { primaryEmployeeId } = req.body || {};
  if (!primaryEmployeeId) {
    return res.status(400).json({ message: 'يلزم معرّف الموظف الجديد' });
  }

  try {
    const course = await coursesService.reassignCourse(id, primaryEmployeeId, req.user, req.activeRole);
    return res.status(200).json(course);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
