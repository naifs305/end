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
                elementType: true,
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

    // ── تحليل العناصر ──
    const totalPending   = pendingElements.length;
    const returned       = pendingElements.filter(e => e.status === 'RETURNED').length;
    const rejected       = pendingElements.filter(e => e.status === 'REJECTED').length;
    const pendingApproval= pendingElements.filter(e => e.status === 'PENDING_APPROVAL').length;
    const notStarted     = pendingElements.filter(e => e.status === 'NOT_STARTED').length;
    const criticalCount  = pendingElements.filter(e => e.element?.elementType === 'MANDATORY').length;

    const overdue = pendingElements.filter(e => {
      if (!e.element?.deadlineMaxHours) return false;
      const course = courseMap[e.courseId];
      if (!course) return false;
      const ref = e.element.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
      return (now - new Date(ref.getTime() + e.element.deadlineMaxHours * 3600000)) > 0;
    }).length;

    // ── بناء بنود الشريط ──
    const tickerItems = [];

    // ١. رسائل المدير — الأعلى أولوية
    for (const n of notifications) {
      const META = {
        MANAGER_WARNING: { icon: '🚨', tone: 'red' },
        MANAGER_REMINDER:{ icon: '🔔', tone: 'amber' },
        MANAGER_INQUIRY: { icon: '💬', tone: 'primary' },
      };
      const m = META[n.type] || { icon: '📩', tone: 'primary' };
      tickerItems.push({ id: n.id, icon: m.icon, text: `${n.title}: ${n.message}`, tone: m.tone });
    }

    // ٢. إجمالي العناصر غير المكتملة — بند رئيسي دائم
    if (totalPending > 0) {
      const breakdown = [
        notStarted      > 0 ? `${notStarted} لم تبدأ` : '',
        returned        > 0 ? `${returned} مُعادة` : '',
        rejected        > 0 ? `${rejected} مرفوضة` : '',
        pendingApproval > 0 ? `${pendingApproval} تنتظر اعتماد` : '',
      ].filter(Boolean).join(' · ');

      const urgentIcon = overdue > 0 ? '🔥' : criticalCount > 0 ? '⚡' : '📋';
      const tone = overdue > 0 ? 'red' : returned > 0 || rejected > 0 ? 'amber' : 'primary';
      tickerItems.push({
        id: 'total-pending',
        icon: urgentIcon,
        text: `لديك ${totalPending} عنصر غير مكتمل${breakdown ? ' — ' + breakdown : ''}`,
        tone,
      });
    } else {
      tickerItems.push({ id: 'all-done', icon: '🎉', text: 'رائع! جميع عناصرك مكتملة في دوراتك النشطة', tone: 'green' });
    }

    // ٣. تنبيهات حرجة مفصّلة
    if (overdue > 0)  tickerItems.unshift({ id: 'overdue',  icon: '⏰', text: `تنبيه: ${overdue} عنصر تجاوز الموعد الأقصى — تصرّف الآن`, tone: 'red' });
    if (returned > 0) tickerItems.push({ id: 'returned', icon: '↩️',  text: `${returned} عنصر مُعاد يحتاج مراجعة وإعادة تقديم`, tone: 'amber' });
    if (rejected > 0) tickerItems.push({ id: 'rejected', icon: '🚫', text: `${rejected} عنصر مرفوض — راجع سبب الرفض وتواصل مع المشرف`, tone: 'red' });
    if (criticalCount > 0 && overdue === 0) tickerItems.push({ id: 'critical', icon: '⚡', text: `${criticalCount} عنصر حرج ينتظر تقديمك — أولوية قصوى`, tone: 'red' });
    if (pendingApproval > 0) tickerItems.push({ id: 'pending-appr', icon: '🕐', text: `${pendingApproval} عنصر بانتظار اعتماد المشرف`, tone: 'primary' });

    // ٤. آخر الأحداث
    for (const t of recentTracking) {
      if (t.status === 'APPROVED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '✅', text: `اعتُمد "${t.element?.name}" — ${t.course?.name}`, tone: 'green' });
      } else if (t.status === 'RETURNED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '↩️', text: `أُعيد "${t.element?.name}" للمراجعة — ${t.course?.name}`, tone: 'amber' });
      } else if (t.status === 'REJECTED') {
        tickerItems.push({ id: `tr-${t.id}`, icon: '🚫', text: `رُفض "${t.element?.name}" — ${t.course?.name}`, tone: 'red' });
      }
    }

    // ٥. درجة الأداء أو ترحيب
    if (kpiSnapshot?.finalScore != null) {
      const score = Number(kpiSnapshot.finalScore).toFixed(1);
      const perfIcon = score >= 90 ? '🏆' : score >= 80 ? '🌟' : score >= 60 ? '📊' : '📉';
      tickerItems.push({
        id: 'kpi-score',
        icon: perfIcon,
        text: `درجتك هذا الشهر: ${score}% — جودة: ${Number(kpiSnapshot.qualityScore || 0).toFixed(1)}% · إنتاجية: ${Number(kpiSnapshot.productivityScore || 0).toFixed(1)}%`,
        tone: score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red',
      });
    } else {
      tickerItems.push({ id: 'welcome', icon: '👋', text: 'مرحباً — تابع دوراتك ومهامك من هنا', tone: 'primary' });
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
        isCritical:  el.element?.elementType === 'MANDATORY',
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
