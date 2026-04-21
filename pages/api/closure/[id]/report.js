// POST /api/closure/[id]/report
// مسار متوافق قديم — يُحوّل لتقرير الاختتام تلقائياً
// (للحفاظ على توافق الصفحات القديمة في الواجهة)

const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const closureService = require('../../../../lib/services/closure');

async function handler(req, res) {
  const { id } = req.query;
  try {
    const result = await closureService.submitClosingReport(id, req.body || {}, req.user, req.activeRole);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
