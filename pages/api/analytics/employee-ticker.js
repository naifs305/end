// GET /api/analytics/employee-ticker
// شريط أخبار الموظف — آخر الأحداث + العناصر المعلّقة + المؤشرات
const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const userId = req.user.id;

  const courseWhere = {
    OR: [
      { primaryEmployeeId: userId },
      { supportingTeam: { some: { userId } } },
    ],
  };

  const now2 = new Date();
  const periodLabel = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}`;

  const [recentTracking, pendingElements, notifications, kpiSnapshot] = await Promise.all([
    // آخر 15 حدث في عناصر الإقفال (معتمد أو مُعاد)
    prisma.courseClosureTracking.findMany({
      where: {
        executedById: userId,
        status: { in: ['APPROVED', 'RETURNED', 'REJECTED'] },
        decisionAt: { not: null },
      },
      select: {
        id: true,
        status: true,
        decisionAt: true,
        element: { select: { name: true } },
        course:  { select: { id: true, name: true } },
      },
      orderBy: { decisionAt: 'desc' },
      take: 15,
    }),
    // العناصر المعلّقة — لم تبدأ أو مُعادة (البحث عبر الدورة لا executedById لأن NOT_STARTED بلا executedById)
    prisma.courseClosureTracking.findMany({
      where: {
        status: { in: ['NOT_STARTED', 'RETURNED'] },
        course: { ...courseWhere, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
      },
      select: {
        id: true,
        status: true,
        executionAt: true,
        element: {
          select: {
            name: true,
            deadlineRefPoint: true,
            deadlineMaxHours: true,
            deadlineIdealHours: true,
            isCritical: true,
          },
        },
        course: { select: { id: true, name: true, startDate: true, endDate: true } },
      },
      orderBy: { executionAt: 'asc' },
      take: 30,
    }),
    // رسائل المدير غير المقروءة
    prisma.notification.findMany({
      where: {
        userId,
        type: { in: ['MANAGER_INQUIRY', 'MANAGER_REMINDER', 'MANAGER_WARNING'] },
        isRead: false,
      },
      select: { id: true, type: true, title: true, message: true, metadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    // لقطة الأداء الشهري
    prisma.employeeKpiSnapshot.findUnique({
      where: { userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel } },
      select: { finalScore: true, qualityScore: true, productivityScore: true },
    }),
  ]);

  // بناء بنود الشريط المتحرك
  const tickerItems = [];

  // رسائل المدير أولاً (الأعلى أولوية)
  for (const n of notifications) {
    const icons = { MANAGER_WARNING: '🚨', MANAGER_REMINDER: '🔔', MANAGER_INQUIRY: '💬' };
    tickerItems.push({
      id:   n.id,
      icon: icons[n.type] || '📩',
      text: `${n.title}: ${n.message}`,
      tone: n.type === 'MANAGER_WARNING' ? 'red' : n.type === 'MANAGER_REMINDER' ? 'amber' : 'primary',
      at:   n.createdAt,
    });
  }

  // العناصر المعتمدة والمُعادة
  for (const t of recentTracking) {
    if (t.status === 'APPROVED') {
      tickerItems.push({
        id:   `tr-${t.id}`,
        icon: '✅',
        text: `تم اعتماد "${t.element?.name}" في دورة: ${t.course?.name}`,
        tone: 'green',
        at:   t.decisionAt,
      });
    } else if (t.status === 'RETURNED') {
      tickerItems.push({
        id:   `tr-${t.id}`,
        icon: '↩',
        text: `أُعيد عنصر "${t.element?.name}" للمراجعة — دورة: ${t.course?.name}`,
        tone: 'amber',
        at:   t.decisionAt,
      });
    } else if (t.status === 'REJECTED') {
      tickerItems.push({
        id:   `tr-${t.id}`,
        icon: '❌',
        text: `رُفض عنصر "${t.element?.name}" — دورة: ${t.course?.name}`,
        tone: 'red',
        at:   t.decisionAt,
      });
    }
  }

  // إحصائية العناصر المعلّقة
  if (pendingElements.length > 0) {
    const returned = pendingElements.filter(e => e.status === 'RETURNED').length;
    const notStarted = pendingElements.filter(e => e.status === 'NOT_STARTED').length;
    if (returned > 0) {
      tickerItems.unshift({
        id: 'pending-returned',
        icon: '⚠️',
        text: `لديك ${returned} عنصر مُعاد يحتاج إعادة تقديم`,
        tone: 'red',
        at: new Date(),
      });
    }
    if (notStarted > 0) {
      tickerItems.unshift({
        id: 'pending-notstarted',
        icon: '📋',
        text: `لديك ${notStarted} عنصر لم تبدأ تقديمه بعد`,
        tone: 'amber',
        at: new Date(),
      });
    }
  }

  // بند ثابت: درجة الأداء الشهري (يضمن ظهور الشريط دائماً)
  if (kpiSnapshot?.finalScore != null) {
    const score = Number(kpiSnapshot.finalScore).toFixed(1);
    const icon = score >= 80 ? '🌟' : score >= 60 ? '📊' : '📉';
    tickerItems.push({
      id: 'kpi-score',
      icon,
      text: `درجتك هذا الشهر: ${score}% — جودة: ${Number(kpiSnapshot.qualityScore || 0).toFixed(1)}% — إنتاجية: ${Number(kpiSnapshot.productivityScore || 0).toFixed(1)}%`,
      tone: score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red',
      at: new Date(),
    });
  } else {
    // لا توجد درجة بعد — بند ثابت للترحيب
    tickerItems.push({
      id: 'welcome',
      icon: '👋',
      text: 'مرحباً — هنا تظهر آخر أحداثك وإشعارات مؤشرات الأداء',
      tone: 'primary',
      at: new Date(),
    });
  }

  // حساب العناصر بأولويتها للوحة التفصيلية
  const now = new Date();
  const pendingWithPriority = pendingElements.map(el => {
    const MS = 3600000;
    const refDate = el.element?.deadlineRefPoint === 'START'
      ? new Date(el.course.startDate)
      : new Date(el.course.endDate);

    let urgency = 0; // 0=normal, 1=approaching, 2=overdue
    let hoursLeft = null;

    if (el.element?.deadlineMaxHours != null) {
      const deadline = new Date(refDate.getTime() + el.element.deadlineMaxHours * MS);
      hoursLeft = (deadline - now) / MS;
      if (hoursLeft < 0) urgency = 2;
      else if (hoursLeft < 24) urgency = 1;
    }

    return {
      id:         el.id,
      status:     el.status,
      elementName: el.element?.name,
      isCritical:  el.element?.isCritical || false,
      courseName: el.course?.name,
      courseId:   el.course?.id,
      urgency,
      hoursLeft:  hoursLeft != null ? Math.round(hoursLeft) : null,
    };
  }).sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    if (b.isCritical !== a.isCritical) return b.isCritical ? 1 : -1;
    if (a.status === 'RETURNED' && b.status !== 'RETURNED') return -1;
    if (b.status === 'RETURNED' && a.status !== 'RETURNED') return 1;
    if (a.hoursLeft != null && b.hoursLeft != null) return a.hoursLeft - b.hoursLeft;
    return 0;
  });

  return res.status(200).json({ tickerItems, pendingElements: pendingWithPriority });
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
