// GET /api/analytics/employee-ticker
const prisma = require('../../../lib/db/prisma');
const { withAuth, withMethods } = require('../../../lib/middleware/auth');

// ── رسائل تحفيزية حسب درجة الأداء ──
const PERF_MSGS = {
  excellent: ['أداؤك استثنائي هذا الشهر — استمر!', 'أنت في القمة — حافظ على هذا المستوى', 'نتائجك تتحدث عن نفسها — عمل رائع'],
  good:      ['أداء جيد — خطوة أخرى وتصل للقمة', 'أنت على الطريق الصحيح — واصل الجهد', 'تقدم ملحوظ هذا الشهر — أحسنت'],
  average:   ['بإمكانك أكثر من هذا — ركّز هذا الأسبوع', 'فرصة للتحسين لا تزال متاحة', 'أكمل ما بدأت — النتائج ستتحسن'],
  low:       ['الوقت مناسب للمراجعة وتعديل المسار', 'لا تتأخر في إنجاز عناصرك المعلّقة'],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ── تحية حسب وقت اليوم ──
function greeting(name, hour) {
  if (hour < 12) return `صباح الخير ${name} — يوم موفق`;
  if (hour < 17) return `مرحباً ${name} — نصف اليوم مضى، كيف سير إنجازاتك؟`;
  return `مساء الخير ${name} — ختم اليوم بإنجاز مميز`;
}

// ── رسالة حسب يوم الأسبوع ──
function weekdayMsg(day) {
  const msgs = {
    0: '📅 الأحد — بداية أسبوع جديد، ضع أهدافك وابدأ',
    1: '📅 الاثنين — يوم الانطلاق الحقيقي',
    2: '📅 الثلاثاء — منتصف الأسبوع يقترب، ضاعف جهدك',
    3: '📅 الأربعاء — منتصف الأسبوع، قيّم إنجازاتك',
    4: '📅 الخميس — الختام الأسبوعي، أنهِ ما بدأت',
    5: null, // جمعة
    6: null, // سبت
  };
  return msgs[day] || null;
}

async function handler(req, res) {
  const { user } = req;
  const userId   = user.id;
  const name     = user.firstName || 'زميلنا';

  try {
    const now         = new Date();
    const hour        = now.getHours();
    const dayOfWeek   = now.getDay();
    const dayOfMonth  = now.getDate();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - dayOfMonth;

    // ── الخطوة ١: دورات الموظف النشطة ──
    const activeCourses = await prisma.course.findMany({
      where: {
        OR: [
          { primaryEmployeeId: userId },
          { supportingTeam: { some: { userId } } },
        ],
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
      },
      select: { id: true, name: true, startDate: true, endDate: true, status: true },
    });
    const activeCourseIds = activeCourses.map(c => c.id);
    const courseMap = Object.fromEntries(activeCourses.map(c => [c.id, c]));

    // ── الخطوة ٢: العناصر غير المكتملة ──
    const pendingElements = activeCourseIds.length > 0
      ? await prisma.courseClosureTracking.findMany({
          where: {
            courseId: { in: activeCourseIds },
            status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] },
          },
          select: {
            id: true, courseId: true, status: true,
            element: { select: { name: true, deadlineRefPoint: true, deadlineMaxHours: true, elementType: true } },
          },
          take: 100,
        })
      : [];

    // ── الخطوة ٣: العناصر المكتملة ──
    const completedCount = activeCourseIds.length > 0
      ? await prisma.courseClosureTracking.count({
          where: { courseId: { in: activeCourseIds }, status: 'APPROVED' },
        })
      : 0;

    // ── الخطوة ٤: رسائل المدير + تعاميم + مؤشر الأداء ──
    const [managerMsgs, announcements, kpiSnapshot] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, type: { in: ['MANAGER_INQUIRY', 'MANAGER_REMINDER', 'MANAGER_WARNING'] }, isRead: false },
        select: { id: true, type: true, title: true, message: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { type: 'TICKER_ANNOUNCEMENT' },
        select: { id: true, message: true, metadata: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.employeeKpiSnapshot.findUnique({
        where: { userId_periodType_periodLabel: { userId, periodType: 'MONTHLY', periodLabel } },
        select: { finalScore: true, qualityScore: true, productivityScore: true },
      }),
    ]);

    // ── تحليل العناصر ──
    const MS = 3600000;
    const returned        = pendingElements.filter(e => e.status === 'RETURNED');
    const rejected        = pendingElements.filter(e => e.status === 'REJECTED');
    const pendingApproval = pendingElements.filter(e => e.status === 'PENDING_APPROVAL');
    const notStarted      = pendingElements.filter(e => e.status === 'NOT_STARTED');
    const totalPending    = pendingElements.length;

    // العناصر المتأخرة وتلك التي تقترب مواعيدها
    const overdueEls = [], upcomingEls = [];
    for (const el of pendingElements) {
      if (!el.element?.deadlineMaxHours) continue;
      const course = courseMap[el.courseId];
      if (!course) continue;
      const ref = el.element.deadlineRefPoint === 'START' ? new Date(course.startDate) : new Date(course.endDate);
      const hoursLeft = (new Date(ref.getTime() + el.element.deadlineMaxHours * MS) - now) / MS;
      if (hoursLeft < 0)  overdueEls.push({ ...el, hoursLeft });
      else if (hoursLeft < 48) upcomingEls.push({ ...el, hoursLeft });
    }

    // ── بناء بنود الشريط ──
    const items = [];

    // ١. تعاميم المدير — الأعلى أولوية
    for (const a of announcements) {
      const exp = a.metadata?.expiresAt;
      if (exp && new Date(exp) < now) continue;
      items.push({ id: `ann-${a.id}`, icon: a.metadata?.icon || '📢', text: a.message, tone: a.metadata?.tone || 'primary' });
    }

    // ٢. رسائل المدير الموجّهة
    for (const n of managerMsgs) {
      const META = { MANAGER_WARNING: { icon: '🚨', tone: 'red' }, MANAGER_REMINDER: { icon: '🔔', tone: 'amber' }, MANAGER_INQUIRY: { icon: '💬', tone: 'primary' } };
      const m = META[n.type] || { icon: '📩', tone: 'primary' };
      items.push({ id: n.id, icon: m.icon, text: `رسالة من مديرك: ${n.title} — ${n.message}`, tone: m.tone });
    }

    // ٣. تنبيهات العناصر المتأخرة — بالاسم
    for (const el of overdueEls.slice(0, 3)) {
      const days = Math.abs(Math.round(el.hoursLeft / 24));
      items.push({
        id: `overdue-${el.id}`, icon: '⏰', tone: 'red',
        text: `متأخر منذ ${days} يوم: "${el.element.name}" في دورة "${courseMap[el.courseId]?.name}" — تصرّف الآن`,
      });
    }
    if (overdueEls.length > 3) {
      items.push({ id: 'overdue-more', icon: '🔥', tone: 'red', text: `و${overdueEls.length - 3} عناصر أخرى تجاوزت مواعيدها — راجع قائمة مهامك` });
    }

    // ٤. عناصر تقترب مواعيدها (خلال 48 ساعة)
    for (const el of upcomingEls.slice(0, 2)) {
      const h = Math.round(el.hoursLeft);
      items.push({
        id: `upcoming-${el.id}`, icon: '⚡', tone: 'amber',
        text: `يتبقى ${h < 24 ? `${h} ساعة` : `${Math.round(h/24)} يوم`}: "${el.element.name}" — قدّمه قبل فوات الأوان`,
      });
    }

    // ٥. عناصر مُعادة — بالاسم
    for (const el of returned.slice(0, 2)) {
      items.push({
        id: `ret-${el.id}`, icon: '↩️', tone: 'amber',
        text: `أُعيد إليك: "${el.element?.name}" — راجع ملاحظات المشرف وأعد التقديم`,
      });
    }

    // ٦. عناصر مرفوضة — بالاسم
    for (const el of rejected.slice(0, 2)) {
      items.push({
        id: `rej-${el.id}`, icon: '🚫', tone: 'red',
        text: `رُفض: "${el.element?.name}" — اطّلع على سبب الرفض وتواصل مع مشرفك`,
      });
    }

    // ٧. ملخص الإنجاز الشخصي
    const totalElements = completedCount + totalPending;
    const pct = totalElements > 0 ? Math.round((completedCount / totalElements) * 100) : 100;
    if (totalElements > 0) {
      items.push({
        id: 'progress', icon: pct === 100 ? '🎯' : pct >= 70 ? '📈' : '📋', tone: pct === 100 ? 'green' : pct >= 50 ? 'primary' : 'amber',
        text: `إنجازك حتى الآن: ${completedCount} عنصر مكتمل من ${totalElements} · ${pct}% · ${totalPending} غير مكتمل`,
      });
    }

    // ٨. تنبيه نهاية الشهر
    if (daysLeftInMonth <= 5 && totalPending > 0) {
      items.push({
        id: 'month-end', icon: '📅', tone: 'red',
        text: `تبقّى ${daysLeftInMonth} يوم${daysLeftInMonth === 1 ? '' : ' أيام'} على نهاية الشهر ولديك ${totalPending} عنصر غير مكتمل — أسرع`,
      });
    }

    // ٩. تعميم بانتظار الاعتماد
    if (pendingApproval.length > 0) {
      items.push({
        id: 'pending-appr', icon: '🕐', tone: 'primary',
        text: `${pendingApproval.length} عنصر${pendingApproval.length === 1 ? '' : ' عناصر'} بانتظار اعتماد مشرفك — ترقّب ردّه`,
      });
    }

    // ١٠. درجة الأداء — مخصصة
    if (kpiSnapshot?.finalScore != null) {
      const score = Number(kpiSnapshot.finalScore);
      const scoreDisplay = score.toFixed(1);
      const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'average' : 'low';
      const perfIcon = score >= 90 ? '🏆' : score >= 75 ? '🌟' : score >= 60 ? '📊' : '📉';
      const tone = score >= 75 ? 'green' : score >= 60 ? 'amber' : 'red';
      items.push({
        id: 'kpi', icon: perfIcon, tone,
        text: `درجتك ${scoreDisplay}% — جودة ${Number(kpiSnapshot.qualityScore||0).toFixed(0)}% · إنتاجية ${Number(kpiSnapshot.productivityScore||0).toFixed(0)}% — ${pick(PERF_MSGS[level])}`,
      });
    }

    // ١١. رسالة مخصصة حسب الوقت واليوم
    items.push({ id: 'greeting', icon: '👋', tone: 'primary', text: greeting(name, hour) });
    const wMsg = weekdayMsg(dayOfWeek);
    if (wMsg) items.push({ id: 'weekday', icon: '📅', tone: 'primary', text: wMsg });

    // ── بناء لوحة العناصر بالأولوية ──
    const pendingWithPriority = pendingElements.map(el => {
      const course = courseMap[el.courseId] || {};
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
      const pa = (a.urgency*100) + (a.status==='RETURNED'?50:0) + (a.isCritical?30:0) + (a.urgency===1?20:0);
      const pb = (b.urgency*100) + (b.status==='RETURNED'?50:0) + (b.isCritical?30:0) + (b.urgency===1?20:0);
      return pb - pa;
    });

    return res.status(200).json({ tickerItems: items, pendingElements: pendingWithPriority });

  } catch (err) {
    console.error('[employee-ticker]', err.message);
    return res.status(200).json({
      tickerItems: [{ id: 'fallback', icon: '👋', text: `مرحباً ${user.firstName} — تابع دوراتك ومهامك`, tone: 'primary' }],
      pendingElements: [],
    });
  }
}

module.exports = withMethods(['GET'], withAuth(handler));
module.exports.default = module.exports;
