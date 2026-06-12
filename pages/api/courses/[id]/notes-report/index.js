// POST /api/courses/[id]/notes-report
// إنشاء وأرشفة تقرير ملاحظات ميداني جديد (سجل غير قابل للتعديل بعد الإرسال)
const prisma = require('../../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../../lib/middleware/auth');
const permissions = require('../../../../../lib/services/permissions');

async function handler(req, res) {
  const { id } = req.query;

  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      primaryEmployee: true,
      operationalProject: true,
    },
  });

  if (!course) {
    return res.status(404).json({ message: 'الدورة غير موجودة' });
  }

  const canView = await permissions.canViewCourse(req.user, req.activeRole, course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بإنشاء هذا التقرير' });
  }

  const body = req.body || {};
  if (!body.notes || !String(body.notes).trim()) {
    return res.status(400).json({ message: 'يرجى كتابة الملاحظات قبل الإرسال' });
  }

  const formData = {
    notes: String(body.notes).trim(),
    attendanceCount: body.attendanceCount != null && body.attendanceCount !== '' ? Number(body.attendanceCount) : null,
    beneficiaryEntity: body.beneficiaryEntity ? String(body.beneficiaryEntity).trim() : null,
    executingPartner: body.executingPartner ? String(body.executingPartner).trim() : null,
    additionalTrainers: body.additionalTrainers ? String(body.additionalTrainers).trim() : null,
    category: body.category || null,
    priority: body.priority || null,
    suggestedAction: body.suggestedAction ? String(body.suggestedAction).trim() : null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
  };

  const report = await prisma.fieldReport.create({
    data: {
      courseId: course.id,
      authorId: req.user.id,
      formData,
    },
  });

  return res.status(201).json({ id: report.id });
}

module.exports = withMethods(['POST'], withAuth(handler));
module.exports.default = module.exports;
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};
