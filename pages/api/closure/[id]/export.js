// =============================================================
// GET /api/closure/[id]/export
// -------------------------------------------------------------
// تصدير التقرير كصفحة HTML قابلة للطباعة
// يختار القالب تلقائياً حسب نوع العنصر:
//   - opening_report → قالب الافتتاح
//   - closing_report / report → قالب الاختتام
// =============================================================

const prisma = require('../../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../../lib/middleware/auth');
const permissions = require('../../../../lib/services/permissions');
const { renderOpeningReport } = require('../../../../lib/reports/openingReport');
const { renderClosingReport } = require('../../../../lib/reports/closingReport');

async function handler(req, res) {
  const { id } = req.query;

  const element = await prisma.courseClosureTracking.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          primaryEmployee: true,
          operationalProject: true,
        },
      },
      element: true,
    },
  });

  if (!element) {
    return res.status(404).json({ message: 'العنصر غير موجود' });
  }

  // التحقق من صلاحية رؤية الدورة
  const canView = await permissions.canViewCourse(req.user, req.activeRole, element.course);
  if (!canView) {
    return res.status(403).json({ message: 'غير مصرح لك بعرض هذا التقرير' });
  }

  const data = element.formData || {};
  const elementKey = element.element.key;

  let html;
  if (elementKey === 'opening_report') {
    html = renderOpeningReport({
      course: element.course,
      element,
      data,
    });
  } else {
    // closing_report أو report (التوافق الخلفي)
    html = renderClosingReport({
      course: element.course,
      element,
      data,
    });
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

// هذا المسار يرد HTML بدلاً من JSON، فنعطّل التحليل التلقائي
module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;

// تكوين خاص: السماح برد HTML
module.exports.config = {
  api: {
    responseLimit: '8mb',
  },
};
