// GET /api/analytics/employee-ticker
const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

async function handler(req, res) {
  const userId = req.user.id;

  try {
    const now = new Date();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // الخطوة ١: جلب دورات الموظف النشطة
    const activeCourses = await prisma.course.findMany({
      where: {
        OR: [
          { primaryEmployeeId: userId },
          { supportingTeam: { some: { userId } } },
        ],
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    });

    const activeCourseIds = activeCourses.map(c => c.id);
    const courseMap = Object.fromEntries(activeCourses.map(c => [c.id, c]));

    // الخطوة ٢: العناصر غير المعتمدة في تلك الدورات
    const pendingElements = activeCourseIds.length > 0
      ? await prisma.courseClosureTracking.findMany({
          where: {
            courseId: { in: activeCourseIds },
            status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] },
          },
          select: {
            id: true,
            courseId: true,
            status: true,
            executionAt: true,
            element: {
              select: {
                name: true,
                deadlineRefPoint: true,
                deadlineMaxHours: true,
                isCritical: true,
              },
            },
          },
          take: 100,
        })
      : [];

    // الخطوة ٣: آخر الأحداث (معتمد/مُعاد/مرفوض)
    const recentTracking = await prisma.courseClosureTracking.findMany({
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
        course: { select: { id: true, name: true } },
      },
      orderBy: { decisionAt: 'desc' },
      take: 15,
    });

    // الخطوة ٤: رسائل المدير + لقطة الأداء
    const [notifications, kpiSnapshot] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId,
          type: { in: ['MANAGER_INQUIRY', 'MANAGER_REMINDER', 'MANAGER_WARNING'] },
          isRead: false,
        },
        select: { id: true, type: true, title: true, message: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.employeeKpiSnapshot.findUnique({
        where: { userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel } },
        select: { finalScore: true, qualityScore: true, productivityScore: true },
      }),
    ]);

    // ── بناء بنود الشريط ──
    const tickerItems = [];

    // رسائل المدير
    for (const n of notifications) {
      const icons = { MANAGER_WARNING: '🚨', MANAGER_REMINDER: '🔔', MANAGER_INQUIRY: '💬' };
      tickerItems.push({
        id: n.id, icon: icons[n.type] || '📩',
        text: `${n.title}: ${n.message}`,
        tone: n.type === 'MANAGER_WARNING' ? 'red' : n.type === 'MANAGER_REMINDER' ? 'amber' : 'primary',
      });
    }

    // تنبيهات العناصر المتأخرة والمُعادة والمرفوضة
    const returned = pendingElements.filter(e => e.status === 'RETURNED').length;
    const rejected = pendingElements.filter(e => e.status === 'REJECTED').length;
    const overdue  = pendingElements.filter(e => {
      if (!e.element?.deadlineMaxHours) return false;
      const course = courseMap[e.courseId];
      if (!course) return false;
      const ref = e.element.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
      return (now - new Date(ref.getTime() + e.element.deadlineMaxHours * 3600000)) > 0;
    }).length;

    if (overdue > 0)  tickerItems.unshift({ id: 'overdue',  icon: '🔴', text: `لديك ${overdue} عنصر تجاوز الموعد الأقصى`, tone: 'red' });
    if (returned > 0) tickerItems.unshift({ id: 'returned', icon: '↩',  text: `لديك ${returned} عنصر مُعاد يحتاج إعادة تقديم`, tone: 'amber' });
    if (rejected > 0) tickerItems.unshift({ id: 'rejected', icon: '❌', text: `لديك ${rejected} عنصر مرفوض — راجع سبب الرفض`, tone: 'red' });

    // آخر الأحداث
    for (const t of recentTracking) {
      if (t.status === 'APPROVED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '✅', text: `تم اعتماد "${t.element?.name}" — ${t.course?.name}`, tone: 'green' });
      } else if (t.status === 'RETURNED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '↩', text: `أُعيد "${t.element?.name}" للمراجعة — ${t.course?.name}`, tone: 'amber' });
      } else if (t.status === 'REJECTED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '❌', text: `رُفض "${t.element?.name}" — ${t.course?.name}`, tone: 'red' });
      }
    }

    // بند ثابت: درجة الأداء أو ترحيب
    if (kpiSnapshot?.finalScore != null) {
      const score = Number(kpiSnapshot.finalScore).toFixed(1);
      tickerItems.push({
        id: 'kpi-score',
        icon: score >= 80 ? '🌟' : score >= 60 ? '📊' : '📉',
        text: `درجتك هذا الشهر: ${score}% — جودة: ${Number(kpiSnapshot.qualityScore || 0).toFixed(1)}% — إنتاجية: ${Number(kpiSnapshot.productivityScore || 0).toFixed(1)}%`,
        tone: score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red',
      });
    } else {
      tickerItems.push({ id: 'welcome', icon: '👋', text: 'مرحباً — هنا تظهر آخر أحداثك وإشعارات مؤشرات الأداء', tone: 'primary' });
    }

    // ── بناء لوحة العناصر بالأولوية ──
    const pendingWithPriority = pendingElements.map(el => {
      const course = courseMap[el.courseId] || {};
      const MS = 3600000;
      let urgency = 0, hoursLeft = null;

      if (el.element?.deadlineMaxHours != null) {
        const ref = el.element.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
        hoursLeft = (new Date(ref.getTime() + el.element.deadlineMaxHours * MS) - now) / MS;
        if (hoursLeft < 0) urgency = 2;
        else if (hoursLeft < 24) urgency = 1;
      }

      return {
        id:          el.id,
        status:      el.status,
        elementName: el.element?.name,
        isCritical:  el.element?.isCritical || false,
        courseName:  course.name,
        courseId:    el.courseId,
        urgency,
        hoursLeft:   hoursLeft != null ? Math.round(hoursLeft) : null,
      };
    }).sort((a, b) => {
      const pa = (a.urgency * 100) + (a.status === 'RETURNED' ? 50 : 0) + (a.isCritical ? 30 : 0) + (a.urgency === 1 ? 20 : 0);
      const pb = (b.urgency * 100) + (b.status === 'RETURNED' ? 50 : 0) + (b.isCritical ? 30 : 0) + (b.urgency === 1 ? 20 : 0);
      return pb - pa;
    });

    return res.status(200).json({ tickerItems, pendingElements: pendingWithPriority });

  } catch (err) {
    console.error('[employee-ticker] خطأ:', err.message);
    // نرجع بيانات جزئية دائماً حتى لا يتعطل الشريط
    return res.status(200).json({
      tickerItems: [{ id: 'fallback', icon: '👋', text: 'مرحباً بك — تحقق من دوراتك ومهامك', tone: 'primary' }],
      pendingElements: [],
      _error: err.message,
    });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
