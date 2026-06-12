const prisma = require('../../../lib/db/prisma');
const { withMethods, withManager } = require('../../../lib/middleware/auth');
const { logAudit } = require('../../../lib/services/audit');

async function handler(req, res) {
  try {
    const { id } = req.query;

    const element = await prisma.closureElement.findUnique({ where: { id } });
    if (!element) return res.status(404).json({ message: 'العنصر غير موجود' });

    const { isActive, name } = req.body || {};
    const data = {};

    if (typeof isActive === 'boolean') data.isActive = isActive;
    if (typeof name === 'string' && name.trim()) data.name = name.trim();

    if (!Object.keys(data).length) {
      return res.status(400).json({ message: 'لا توجد بيانات لتحديثها' });
    }

    const updated = await prisma.closureElement.update({ where: { id }, data });

    await logAudit(
      req.user.id,
      req.activeRole,
      'CLOSURE_ELEMENT_UPDATED',
      { elementId: id, name: element.name, changes: data },
      null
    );

    return res.status(200).json(updated);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.message });
  }
}

module.exports = withMethods(['PATCH'], withManager(handler));
module.exports.default = module.exports;
