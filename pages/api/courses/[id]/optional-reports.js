// GET  /api/courses/[id]/optional-reports  → قائمة التقارير الاختيارية
// POST /api/courses/[id]/optional-reports  → إضافة تقرير جديد
const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');

async function handler(req, res) {
  const { id } = req.query;
  const { user } = req;

  // تحقق من وجود الدورة
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, primaryEmployeeId: true },
  });
  if (!course) return res.status(404).json({ message: 'الدورة غير موجودة' });

  // ── GET ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const reports = await prisma.courseOptionalReport.findMany({
      where: { courseId: id },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(reports);
  }

  // ── POST ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { title, content } = req.body || {};
    if (!content?.trim()) {
      return res.status(400).json({ message: 'محتوى التقرير مطلوب' });
    }

    const report = await prisma.courseOptionalReport.create({
      data: {
        courseId: id,
        authorId: user.id,
        title:   title?.trim() || null,
        content: content.trim(),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
    return res.status(201).json(report);
  }

  return res.status(405).json({ message: 'Method Not Allowed' });
}

module.exports = withAuth(handler);
module.exports.default = module.exports;
