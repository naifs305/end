const { withMethods, withManagerOrSupervisor, withValidation, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/courses/courses.service');
const { reassignSchema } = require('../../../../lib/modules/courses/courses.schema');

async function handler(req, res) {
  try {
    return await withValidation(reassignSchema, (r, s) => {
      const { primaryEmployeeId } = r.valid || {};
      if (!primaryEmployeeId) {
        return s.status(400).json({ message: 'معرف الموظف الجديد مطلوب', code: 'serverErrors.course.primaryEmployeeRequired' });
      }
      return svc.reassignCourse(r.query.id, primaryEmployeeId, r.user, r.activeRole).then((x) => ok(s, x));
    })(req, res);
  } catch (error) {
    return fail(res, error);
  }
}

module.exports = withMethods(['PUT'], withManagerOrSupervisor(handler));
module.exports.default = module.exports;
