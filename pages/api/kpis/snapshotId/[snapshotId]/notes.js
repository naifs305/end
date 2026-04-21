// POST /api/kpis/[snapshotId]/notes
const { withManager, withMethods } = require('../../../../lib/middleware/auth');
const kpis = require('../../../../lib/services/kpis');

async function handler(req, res) {
  const { snapshotId } = req.query;
  const { userId, note } = req.body || {};

  if (!userId || !note) {
    return res.status(400).json({ message: 'معرف المستخدم والملاحظة مطلوبان' });
  }

  try {
    const created = await kpis.addManagerNote(snapshotId, userId, req.user.id, note);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['POST'], withManager(handler));
module.exports.default = module.exports;
