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
    if (activeRole !== 'MANAGER') return;

    setManagerCoursesLoading(true);
    api
      .get('/courses')
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setManagerCourses(rows);
      })
      .catch(() => setManagerCourses([]))
      .finally(() => setManagerCoursesLoading(false));
  }, [activeRole]);

  useEffect(() => {
    if (activeRole !== 'EMPLOYEE' || !user?.id) return;

    const now = new Date();
    const periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    setEmployeeLoading(true);

    Promise.all([
      api.get('/courses'),
      api.get('/kpis', {
        params: {
          periodType: 'MONTHLY',
          periodLabel,
        },
      }),
    ])
      .then(([coursesRes, kpiRes]) => {
        const courseRows = Array.isArray(coursesRes.data) ? coursesRes.data : [];
        const kpiRowsData = Array.isArray(kpiRes.data) ? kpiRes.data : [];

        setEmployeeCourses(courseRows);

        const myKpi =
          kpiRowsData.find((row) => row.user?.id === user.id || row.userId === user.id) || null;

        setEmployeeKpi(myKpi);
      })
      .catch(() => {
        setEmployeeCourses([]);
        setEmployeeKpi(null);
      })
      .finally(() => setEmployeeLoading(false));
  }, [activeRole, user]);

  const topPerformer = kpiRows?.length ? kpiRows[0] : null;
  const lowPerformer = kpiRows?.length ? kpiRows[kpiRows.length - 1] : null;
  const averageScore = kpiRows?.length
    ? formatNumber(
        kpiRows.reduce((sum, item) => sum + Number(item.finalScore || 0), 0) / kpiRows.length,
      )
    : '0.00';

  const managerPendingApprovalElements = Number(stats?.pendingApprovals || 0);

  const managerEndedNotClosedCourses = useMemo(
    () => managerCourses.filter((course) => isCourseEndedAndNotClosed(course)),
    [managerCourses],
  );

  const employeeClosedCourses = useMemo(
    () => employeeCourses.filter((course) => ['CLOSED', 'ARCHIVED'].includes(course.status)),
    [employeeCourses],
  );

  const employeeOpenCourses = useMemo(
    () => employeeCourses.filter((course) => !['CLOSED', 'ARCHIVED'].includes(course.status)),
    [employeeCourses],
  );

  const employeePendingApprovalCourses = useMemo(
    () =>
      employeeCourses.filter((course) =>
        Array.isArray(course.closureElements)
          ? course.closureElements.some((el) => el.status === 'PENDING_APPROVAL')
          : false,
      ),
    [employeeCourses],
  );

  if (loading) {
    return <div className="p-10 font-cairo text-text-main">جاري التحميل...</div>;
  }

  if (!user) return null;

  return (
    <MainLayout>
      <div className="min-h-full bg-background p-4 md:p-6">
        <div className="mb-6 rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-text-main">مرحبًا، {user.firstName}</h1>
              <p className="mt-2 text-sm text-text-soft">
                منصة حوكمة العمليات التدريبية بهوية جامعة نايف العربية للعلوم الأمنية
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeRole === 'EMPLOYEE' && (
                <Link href="/courses/create">
                  <button className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark">
                    + إضافة دورة جديدة
                  </button>
                </Link>
              )}

              <div className="inline-flex w-fit items-center rounded-2xl border border-primary/20 bg-primary-light px-4 py-2 text-sm font-bold text-primary">
                {isAdmin ? 'لوحة المدير' : 'لوحة المعلومات'}
              </div>
            </div>
          </div>
        </div>

        {isAdmin && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/courses">
                <div className="cursor-pointer">
                  <KPICard title="إجمالي الدورات" value={stats.total} />
                </div>
              </Link>

              <Link href="/courses?status=PREPARATION">
                <div className="cursor-pointer">
                  <KPICard title="قيد الإعداد" value={stats.preparation} />
                </div>
              </Link>

              <Link href="/courses?status=EXECUTION">
                <div className="cursor-pointer">
                  <KPICard title="قيد التنفيذ" value={stats.execution} />
                </div>
              </Link>

              <Link href="/courses?status=AWAITING_CLOSURE">
                <div className="cursor-pointer">
                  <KPICard title="بانتظار الإغلاق" value={stats.awaiting} />
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/kpis">
                <div className="cursor-pointer">
                  <KPICard title="عدد الموظفين" value={kpiRows.length || 0} />
                </div>
              </Link>

              <Link href="/approvals">
                <div className="cursor-pointer">
                  <KPICard title="العناصر بانتظار الاعتماد" value={managerPendingApprovalElements} color="yellow" />
                </div>
              </Link>

              <Link href="/courses">
                <div className="cursor-pointer">
                  <KPICard title="دورات منتهية لم تغلق" value={managerEndedNotClosedCourses.length} color="red" />
                </div>
              </Link>

              <Link href="/kpis">
                <div className="cursor-pointer">
                  <KPICard
                    title="الأعلى أداءً"
                    value={
                      topPerformer
                        ? `${topPerformer.user?.firstName || ''} ${topPerformer.user?.lastName || ''}`.trim()
                        : '-'
                    }
                  />
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Link href="/reports">
                <div className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-light/30">
                  <div className="mb-2 text-lg font-extrabold text-primary">التقارير</div>
                  <div className="text-sm leading-7 text-text-soft">
                    تقارير متقدمة مع فلاتر وتصدير Excel و PDF
                  </div>
                </div>
              </Link>

              <Link href="/archive">
                <div className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-light/30">
                  <div className="mb-2 text-lg font-extrabold text-primary">أرشيف الإقفالات</div>
                  <div className="text-sm leading-7 text-text-soft">
                    أرشفة متقدمة للدورات المغلقة وسجل الإقفالات
                  </div>
                </div>
              </Link>

              <Link href="/messages">
                <div className="cursor-pointer rounded-2xl border border-border bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-light/30">
                  <div className="mb-2 text-lg font-extrabold text-primary">المراسلات</div>
                  <div className="text-sm leading-7 text-text-soft">
                    نظام مراسلة داخلي بسيط بين المستخدمين
                  </div>
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-primary">ملخص الأداء الشهري</h3>
                  <Link href="/kpis" className="text-sm font-bold text-primary hover:text-primary-dark">
                    فتح مؤشرات الأداء
                  </Link>
                </div>

                {kpiLoading ? (
                  <div className="text-sm text-text-soft">جاري تحميل البيانات...</div>
                ) : kpiRows.length === 0 ? (
                  <div className="text-sm text-text-soft">لا توجد بيانات KPI للشهر الحالي</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                      <span className="text-sm text-text-soft">الأعلى أداءً</span>
                      <span className="text-sm font-extrabold text-text-main">
                        {topPerformer
                          ? `${topPerformer.user?.firstName || ''} ${topPerformer.user?.lastName || ''}`.trim()
                          : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                      <span className="text-sm text-text-soft">الأقل أداءً</span>
                      <span className="text-sm font-extrabold text-text-main">
                        {lowPerformer
                          ? `${lowPerformer.user?.firstName || ''} ${lowPerformer.user?.lastName || ''}`.trim()
                          : '-'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                      <span className="text-sm text-text-soft">متوسط الدرجة</span>
                      <span className="text-sm font-extrabold text-primary">{averageScore}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
                      <span className="text-sm text-text-soft">الدورات المنتهية غير المغلقة</span>
                      <span className="text-sm font-extrabold text-danger">{managerEndedNotClosedCourses.length}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-danger/20 bg-white p-6 shadow-card">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-extrabold text-danger">
                    الاعتمادات المعلقة ({managerPendingApprovalElements})
                  </h3>
                  <Link href="/approvals" className="text-sm font-bold text-primary hover:text-primary-dark">
                    عرض الكل
                  </Link>
                </div>
                <div className="rounded-2xl border border-danger/10 bg-red-50 px-4 py-4 text-sm leading-7 text-danger">
                  يوجد {managerPendingApprovalElements} عنصر بانتظار اعتمادك الآن. مراجعة هذه العناصر أولًا تضمن
                  عدم تعطّل الإقفالات وتأخر الفرق التشغيلية.
                </div>

                <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-4 text-sm leading-7 text-text-soft">
                  {managerCoursesLoading
                    ? 'جاري تحميل الدورات المنتهية غير المغلقة...'
                    : `يوجد ${managerEndedNotClosedCourses.length} دورة انتهى تاريخها ولم تغلق بعد.`}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-extrabold text-primary">الدورات المنتهية ولم تغلق بعد</h3>
                <Link href="/courses" className="text-sm font-bold text-primary hover:text-primary-dark">
                  فتح إدارة الدورات
                </Link>
              </div>

              {managerCoursesLoading ? (
                <div className="text-sm text-text-soft">جاري تحميل البيانات...</div>
              ) : managerEndedNotClosedCourses.length === 0 ? (
                <div className="text-sm text-text-soft">لا توجد دورات منتهية غير مغلقة حاليًا</div>
              ) : (
                <div className="space-y-3">
                  {managerEndedNotClosedCourses.slice(0, 6).map((course) => (
                    <Link key={course.id} href={`/courses/${course.id}`}>
                      <div className="cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 transition hover:border-primary/30 hover:bg-primary-light/30">
                        <div className="mb-1 text-sm font-extrabold text-text-main">{course.name || '-'}</div>
                        <div className="text-xs text-text-soft">
                          {formatDate(course.startDate)} — {formatDate(course.endDate)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeRole === 'EMPLOYEE' && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Link href="/courses/create">
                <div className="cursor-pointer">
                  <KPICard title="إضافة دورة جديدة" value="+" color="primary" />
                </div>
              </Link>

              <Link href="/courses">
                <div className="cursor-pointer">
                  <KPICard title="الدورات غير المنتهية" value={employeeOpenCourses.length} color="yellow" />
                </div>
              </Link>

              <Link href="/archive">
                <div className="cursor-pointer">
                  <KPICard title="الدورات المنتهية" value={employeeClosedCourses.length} color="green" />
                </div>
              </Link>

              <Link href="/courses">
                <div className="cursor-pointer">
                  <KPICard title="لم تعتمد بعد" value={employeePendingApprovalCourses.length} color="red" />
                </div>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <MetricCard
                title="نسبة سرعة الإنجاز"
                value={formatPercent(employeeKpi?.speedScore)}
                subtitle="تعكس سرعة تنفيذك وإقفال العناصر خلال الفترة الحالية"
              />
              <MetricCard
                title="نسبة الانضباط"
                value={formatPercent(employeeKpi?.disciplineScore)}
                subtitle="تعكس انتظامك وتقليل التأخر والعناصر المعلقة"
              />
              <MetricCard
                title="أداء الموظف"
                value={formatPercent(employeeKpi?.finalScore)}
                subtitle="المحصلة العامة لأدائك بحسب مؤشرات المنصة"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <CourseListCard
                title="الدورات المنتهية"
                items={employeeClosedCourses}
                emptyText="لا توجد دورات منتهية حاليًا"
              />

              <CourseListCard
                title="الدورات غير المنتهية"
                items={employeeOpenCourses}
                emptyText="لا توجد دورات غير منتهية حاليًا"
              />

              <CourseListCard
                title="الدورات التي لم تعتمد بعد"
                items={employeePendingApprovalCourses}
                emptyText="لا توجد دورات بانتظار الاعتماد حاليًا"
              />
            </div>

            {employeeLoading && (
              <div className="rounded-2xl border border-border bg-white p-4 text-sm text-text-soft shadow-card">
                جاري تحميل بيانات لوحة المعلومات...
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

function MetricCard({ title, value, subtitle }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-2 text-sm font-bold text-text-soft">{title}</div>
      <div className="mb-2 text-3xl font-extrabold text-primary">{value}</div>
      <div className="text-sm leading-7 text-text-soft">{subtitle}</div>
    </div>
  );
}

function CourseListCard({ title, items, emptyText }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-primary">{title}</h3>
        <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-text-soft">{emptyText}</div>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((course) => (
            <Link key={course.id} href={`/courses/${course.id}`}>
              <div className="cursor-pointer rounded-2xl border border-border bg-background px-4 py-3 transition hover:border-primary/30 hover:bg-primary-light/30">
                <div className="mb-1 text-sm font-extrabold text-text-main">{course.name || '-'}</div>
                <div className="text-xs text-text-soft">
                  {formatDate(course.startDate)} — {formatDate(course.endDate)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}