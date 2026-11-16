// /api/courses/[id]/closure-review — تقييم صعوبات الإقفال بعد إقفال الدورة
//   GET  التقييم وقائمة الإدارات وأنواع الصعوبات
//   PUT  { noIssues, note, issues: [{ department, issueType, impact, delayDays, note }] }
const { withMethods, withAuth, ok, fail } = require('../../../../lib/server/http');
const svc = require('../../../../lib/modules/departments/departments.service');

async function handler(req, res) {
  const actor = { user: req.user, activeRole: req.activeRole };
  try {
    if (req.method === 'PUT') return ok(res, await svc.saveReview(req.query.id, req.body || {}, actor));
    return ok(res, await svc.getReview(req.query.id, actor));
  } catch (e) {
    return fail(res, e);
  }
}

module.exports = withMethods(['GET', 'PUT'], withAuth(handler));
module.exports.default = module.exports;
