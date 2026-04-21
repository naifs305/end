// GET/POST /api/kpis/assignments
const { withManager, withMethods } = require('../../../lib/middleware/auth');
const kpis = require('../../../lib/services/kpis');

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { periodType, year, value } = req.query;
      if (!periodType || !year) {
        return res.status(400).json({ message: 'periodType و year مطلوبان' });
      }
      const data = await kpis.getAssignmentRegister(
        periodType,
        Number(year),
        value ? Number(value) : undefined,
      );
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { userId, periodType, year, value, assignedCoursesCount, notes } = req.body || {};
      if (!userId || !periodType || !year) {
        return res.status(400).json({ message: 'بيانات الإسناد غير مكتملة' });
      }
      const saved = await kpis.upsertAssignmentRegister(
        req.user.id,
        userId,
        periodType,
        Number(year),
        value ? Number(value) : undefined,
        Number(assignedCoursesCount),
        notes,
      );
      return res.status(200).json(saved);
    }
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
}

module.exports = withMethods(['GET', 'POST'], withManager(handler));
module.exports.default = module.exports;
