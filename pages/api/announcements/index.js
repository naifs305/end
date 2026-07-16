// GET  — قائمة التعاميم النشطة (للجميع)
// POST — إضافة تعميم جديد (للمدير فقط)
// DELETE ?id=xxx — حذف تعميم (للمدير فقط)
const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

const ANNOUNCEMENT_TYPE = 'TICKER_ANNOUNCEMENT';

async function handler(req, res) {
  const { user, activeRole } = req;
  const isManager = activeRole === 'MANAGER';

  // ── GET: جلب التعاميم النشطة ──
  if (req.method === 'GET') {
    const now = new Date();
    const rows = await prisma.notification.findMany({
      where: {
        type: ANNOUNCEMENT_TYPE,
        // metadata.expiresAt إما null أو في المستقبل
      },
      select: {
        id: true,
        title: true,
        message: true,
        metadata: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // فلترة المنتهية يدوياً (لأن expiresAt مخزّن في metadata)
    const active = rows.filter(r => {
      const exp = r.metadata?.expiresAt;
      return !exp || new Date(exp) > now;
    });

    return res.status(200).json(active);
  }

  // ── POST: إضافة تعميم ──
  if (req.method === 'POST') {
    if (!isManager) return res.status(403).json({ message: 'للمدير فقط' });
    const { content, icon = '📢', tone = 'primary', expiresAt } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ message: 'محتوى التعميم مطلوب' });

    const ann = await prisma.notification.create({
      data: {
        userId: user.id,
        type: ANNOUNCEMENT_TYPE,
        title: 'تعميم',
        message: content.trim(),
        isRead: true, // لا يحتاج "قراءة"
        metadata: { icon, tone, expiresAt: expiresAt || null, createdByName: `${user.firstName} ${user.lastName}` },
      },
    });

    return res.status(201).json(ann);
  }

  // ── DELETE: حذف تعميم ──
  if (req.method === 'DELETE') {
    if (!isManager) return res.status(403).json({ message: 'للمدير فقط' });
    const { id } = req.query;
    if (!id) return res.status(400).json({ message: 'id مطلوب' });

    const ann = await prisma.notification.findUnique({ where: { id } });
    if (!ann || ann.type !== ANNOUNCEMENT_TYPE) return res.status(404).json({ message: 'التعميم غير موجود' });

    await prisma.notification.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }
}

module.exports = withMethods(['GET', 'POST', 'DELETE'], withAuth(handler));
module.exports.default = module.exports;
