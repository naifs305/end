// PUT /api/closure/[id]
const { withAuth, withMethods } = require('../../../lib/middleware/auth');
const closureService = require('../../../lib/services/closure');

async function handler(req, res) {
  const { id } = req.query;
  try {
    const result = await closureService.updateStatus(id, req.body || {}, req.user, req.activeRole);
    return res.status(200).json(result);
  } catch (err) {
    console.error('خطأ تحديث العنصر:', err);
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['PUT'], withAuth(handler));
module.exports.default = module.exports;
