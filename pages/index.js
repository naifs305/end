import { isAdminRole } from '../lib/roles';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import KPICard from '../components/shared/KPICard';
import Link from 'next/link';

function formatNumber(value) {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return '0';
  return num.toFixed(2);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ar-SA');
}

function formatPercent(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${num.toFixed(2)}%`;
}

function isCourseEndedAndNotClosed(course) {
  if (!course?.endDate) return false;

  const endDate = new Date(course.endDate);
  const now = new Date();

  return endDate < now && !['CLOSED', 'ARCHIVED'].includes(course.status);
}

export default function Home() {
  const router = useRouter();
  const { user, activeRole, loading } = useAuth();
  const isAdmin = isAdminRole(activeRole);

  const [stats, setStats] = useState(null);
  const [kpiRows, setKpiRows] = useState([]);
  const [kpiLoading, setKpiLoading] = useState(false);

  const [employeeCourses, setEmployeeCourses] = useState([]);
  const [employeeKpi, setEmployeeKpi] = useState(null);
  const [employeeLoading, setEmployeeLoading] = useState(false);

  const [managerCourses, setManagerCourses] = useState([]);
  const [managerCoursesLoading, setManagerCoursesLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!activeRole) return;

    const endpoint = isAdmin ? '/analytics/manager' : '/analytics/employee';
    api
      .get(endpoint)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [activeRole]);

  useEffect(() => {
    if (activeRole !== 'MANAGER') return;

    const now = new Date();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setKpiLoading(true);
    api
      .get('/kpis', {
        params: {
          periodType: 'MONTHLY',
          periodLabel,
        },
      })
      .then((res) => setKpiRows(res.data || []))
      .catch(() => setKpiRows([]))
      .finally(() => setKpiLoading(false));
  }, [activeRole]);

  useEffect(() => {
    if (!user?.id) return;

    if (activeRole === 'MANAGER') {
      setEmployeeCourses([]);
      setEmployeeKpi(null);
      setEmployeeLoading(false);

      setManagerCoursesLoading(true);
      api
        .get('/courses')
        .then((res) => setManagerCourses(res.data || []))
        .catch(() => setManagerCourses([]))
        .finally(() => setManagerCoursesLoading(false));

      return;
    }

    setManagerCourses([]);
    setManagerCoursesLoading(false);

    setEmployeeLoading(true);

    const now = new Date();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    Promise.all([
      api
        .get('/analytics/employee', {
          params: { userId: user.id },
        })
        .then((res) => res.data)
        .catch(() => null),
      api
        .get(`/kpis/${user.id}/MONTHLY/${periodLabel}`)
        .then((res) => res.data)
        .catch(() => null),
    ])
      .then(([employeeAnalytics, employeeKpiSnapshot]) => {
        setEmployeeCourses(employeeAnalytics?.courses || []);
        setEmployeeKpi(employeeKpiSnapshot);
      })
      .finally(() => setEmployeeLoading(false));
  }, [activeRole, user?.id]);

  const dashboardCards = useMemo(() => {
    if (!stats) return [];

    return [
      {
        title: 'الدورات',
        value: stats.totalCourses ?? 0,
        subtitle: 'إجمالي الدورات المسجلة',
      },
      {
        title: 'بانتظار الإقفال',
        value: stats.awaitingClosureCourses ?? 0,
        subtitle: 'دورات منتهية لم تُقفل بعد',
      },
      {
        title: 'العناصر المعلقة',
        value: stats.pendingElements ?? 0,
        subtitle: 'عناصر بانتظار الإجراء أو الاعتماد',
      },
      {
        title: 'الإشعارات غير المقروءة',
        value: stats.unreadNotifications ?? 0,
        subtitle: 'إشعارات جديدة تحتاج متابعة',
      },
    ];
  }, [stats]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        جاري التحميل...
      </div>
    );
  }

  return (
    <MainLayout title="لوحة المعلومات">
      <div className="space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {dashboardCards.map((card) => (
            <KPICard
              key={card.title}
              title={card.title}
              value={card.value}
              subtitle={card.subtitle}
            />
          ))}
        </section>

        {activeRole === 'MANAGER' ? (
          <>
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    أداء الموظفين الشهري
                  </h2>
                  <p className="text-sm text-gray-500">
                    ملخص آخر لقطة KPI للفترة الحالية
                  </p>
                </div>

                <Link
                  href="/kpis"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  عرض التفاصيل
                </Link>
              </div>

              {kpiLoading ? (
                <div className="text-sm text-gray-500">جاري تحميل المؤشرات...</div>
              ) : kpiRows.length === 0 ? (
                <div className="text-sm text-gray-500">لا توجد بيانات KPI حالياً.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-right text-gray-500 border-b">
                        <th className="py-3 px-3">الموظف</th>
                        <th className="py-3 px-3">النتيجة النهائية</th>
                        <th className="py-3 px-3">المستوى</th>
                        <th className="py-3 px-3">إكمال العناصر</th>
                        <th className="py-3 px-3">إقفال الدورات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiRows.map((row) => (
                        <tr key={row.userId} className="border-b last:border-0">
                          <td className="py-3 px-3 font-medium text-gray-900">
                            {row.userName}
                          </td>
                          <td className="py-3 px-3">{formatNumber(row.finalScore)}</td>
                          <td className="py-3 px-3">{row.performanceLevel}</td>
                          <td className="py-3 px-3">
                            {formatPercent(row.closureCompletionRate)}
                          </td>
                          <td className="py-3 px-3">
                            {formatPercent(row.dueCourseClosureRate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    الدورات التي تحتاج تدخلاً
                  </h2>
                  <p className="text-sm text-gray-500">
                    الدورات المنتهية التي لم تُقفل حتى الآن
                  </p>
                </div>

                <Link
                  href="/courses"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  الانتقال إلى الدورات
                </Link>
              </div>

              {managerCoursesLoading ? (
                <div className="text-sm text-gray-500">جاري تحميل الدورات...</div>
              ) : (
                <div className="space-y-3">
                  {managerCourses.filter(isCourseEndedAndNotClosed).length === 0 ? (
                    <div className="text-sm text-gray-500">
                      لا توجد دورات متأخرة حالياً.
                    </div>
                  ) : (
                    managerCourses
                      .filter(isCourseEndedAndNotClosed)
                      .slice(0, 8)
                      .map((course) => (
                        <div
                          key={course.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50"
                        >
                          <div>
                            <div className="font-semibold text-gray-900">{course.name}</div>
                            <div className="text-sm text-gray-600">
                              انتهاء الدورة: {formatDate(course.endDate)}
                            </div>
                          </div>

                          <Link
                            href={`/courses/${course.id}`}
                            className="text-sm font-medium text-primary-700 hover:text-primary-800"
                          >
                            فتح الدورة
                          </Link>
                        </div>
                      ))
                  )}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    مؤشري التشغيلي لهذا الشهر
                  </h2>
                  <p className="text-sm text-gray-500">
                    لقطة مختصرة لأداء الإقفال والتنفيذ
                  </p>
                </div>

                <Link
                  href="/kpis"
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  عرض المؤشرات
                </Link>
              </div>

              {employeeLoading ? (
                <div className="text-sm text-gray-500">جاري تحميل البيانات...</div>
              ) : !employeeKpi ? (
                <div className="text-sm text-gray-500">
                  لا توجد لقطة KPI متاحة لهذا الشهر حتى الآن.
                </div>
              ) : (
                <div