/**
 * GET /api/webhooks/course-lookup?code=od-2026-0019
 *
 * يبحث عن دورة برمزها أو جزء من اسمها — يُستخدم من منصة السلف لربط
 * طلبات سلفة قديمة لم تُربط بدورتها وقت إنشائها (قبل تفعيل الربط التلقائي).
 *
 * Auth: Authorization: Bearer <WEBHOOK_SECRET>
 */
const prisma = require('../../../lib/db/prisma');

function withMethods(methods, handler) {
  return async (req, res) => {
    if (!methods.includes(req.method)) return res.status(405).json({ message: 'Method Not Allowed' });
    return handler(req, res);
  };
}

function readSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return req.query?.secret;
}

async function handler(req, res) {
  const expectedSecret = process.env.WEBHOOK_SECRET || process.env.SOLF_WEBHOOK_SECRET;
  if (!expectedSecret || readSecret(req) !== expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const q = String(req.query.code || req.query.q || '').trim();
  if (!q) return res.status(400).json({ message: 'code أو q مطلوب' });

  try {
    const courses = await prisma.course.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        startDate: true,
        endDate: true,
        primaryEmployee: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 10,
    });

    return res.status(200).json({
      ok: true,
      courses: courses.map((c) => ({
        id: c.id,
        code: c.code,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        employeeName: `${c.primaryEmployee?.firstName || ''} ${c.primaryEmployee?.lastName || ''}`.trim(),
        employeeEmail: c.primaryEmployee?.email || null,
      })),
    });
  } catch (err) {
    console.error('[Webhook] course-lookup error:', err);
    return res.status(500).json({ message: 'خطأ داخلي' });
  }
}

module.exports = withMethods(['GET'], handler);
module.exports.default = module.exports;
