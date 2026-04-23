import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import useAuth from '../../context/AuthContext';
import { canCreateCourse, normalizeRole } from '../../lib/roles';

const PAGE_SIZE = 10;

function statusLabel(status) {
  const map = {
    PREPARATION: 'قيد الإعداد',
    EXECUTION: 'قيد التنفيذ',
    AWAITING_CLOSURE: 'بانتظار الإقفال',
    CLOSED: 'مقفلة',
    ARCHIVED: 'مؤرشفة',
  };
  return map[status] || status || 'غير محدد';
}

function formatDate(date) {
  if (!date) return '-';
  try { return new Date(date).toLocaleDateString('ar-SA'); } catch { return '-'; }
}

function employeeName(user) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '-';
}

export default function CoursesPage() {
  const router = useRouter();
  const { activeRole, user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', status: 'ALL', project: '', employee: '' });

  const role = normalizeRole(activeRole) || 'EMPLOYEE';

  const loadCourses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/courses');
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCourses(); }, []);

  const projectOptions = useMemo(() => [...new Set(courses.map((course) => course.operationalProject?.name).filter(Boolean))], [courses]);
  const employeeOptions = useMemo(() => [...new Set(courses.map((course) => employeeName(course.primaryEmployee)).filter(Boolean))], [courses]);

  const filteredCourses = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch = !q || [course.name, course.code, course.city, course.operationalProject?.name, employeeName(course.primaryEmployee)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      const matchesStatus = filters.status === 'ALL' || course.status === filters.status;
      const matchesProject = !filters.project || course.operationalProject?.name === filters.project;
      const matchesEmployee = !filters.employee || employeeName(course.primaryEmployee) === filters.employee;
      return matchesSearch && matchesStatus && matchesProject && matchesEmployee;
    });
  }, [courses, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const paginatedCourses = filteredCourses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.project, filters.employee]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async (courseId) => {
    if (!confirm('هل تريد حذف الدورة؟')) return;
    try {
      setBusyId(courseId);
      await api.delete(`/courses/${courseId}`);
      await loadCourses();
    } catch (e) {
      alert(e?.response?.data?.message || 'تعذر حذف الدورة');
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async (courseId) => {
    try {
      setBusyId(courseId);
      await api.put(`/courses/${courseId}/archive`);
      await loadCourses();
    } catch (e) {
      alert(e?.response?.data?.message || 'تعذر أرشفة الدورة');
    } finally {
      setBusyId(null);
    }
  };

  const handleReassign = async (courseId) => {
    const newEmployeeId = prompt('أدخل معرف المستخدم الجديد لإعادة الإسناد');
    if (!newEmployeeId) return;
    try {
      setBusyId(courseId);
      await api.put(`/courses/${courseId}/reassign`, { primaryEmployeeId: newEmployeeId });
      await loadCourses();
    } catch (e) {
      alert(e?.response?.data?.message || 'تعذر إعادة الإسناد');
    } finally {
      setBusyId(null);
    }
  };

  const canManageCourse = (course) => role === 'MANAGER' || role === 'PROJECT_SUPERVISOR' || course?.primaryEmployeeId === user?.id;
  const canDeleteCourse = (course) => role === 'MANAGER' || role === 'PROJECT_SUPERVISOR' || (role === 'EMPLOYEE' && course?.status === 'PREPARATION');

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-right">
              <h1 className="text-3xl font-extrabold text-primary">الدورات النشطة</h1>
              <p className="mt-2 text-sm text-text-soft">عرض منظم مع فلترة وتقسيم صفحات لتخفيف الحمل وسرعة الوصول</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {canCreateCourse(role) && (
                <button onClick={() => router.push('/courses/create')} className="rounded-2xl bg-primary px-5 py-3 text-sm font-extrabold text-white hover:bg-primary-dark">
                  إضافة دورة جديدة
                </button>
              )}
              <button onClick={() => router.push('/archive')} className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main hover:bg-background">
                الأرشيف
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-primary">الفلاتر</h2>
            <button
              type="button"
              onClick={() => setFilters({ search: '', status: 'ALL', project: '', employee: '' })}
              className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background"
            >
              إعادة تعيين
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="بحث باسم الدورة أو المدينة أو الكود"
              className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
              <option value="ALL">كل الحالات</option>
              <option value="PREPARATION">قيد الإعداد</option>
              <option value="EXECUTION">قيد التنفيذ</option>
              <option value="AWAITING_CLOSURE">بانتظار الإقفال</option>
              <option value="CLOSED">مقفلة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>
            <select value={filters.project} onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))} className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
              <option value="">كل المشاريع</option>
              {projectOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select value={filters.employee} onChange={(e) => setFilters((prev) => ({ ...prev, employee: e.target.value }))} className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10">
              <option value="">كل الموظفين</option>
              {employeeOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </section>

        {loading ? (
          <div className="rounded-3xl border border-border bg-background p-16 text-center text-text-soft">جاري التحميل...</div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-3xl border border-border bg-background p-16 text-center text-text-soft">لا توجد دورات حاليًا</div>
        ) : (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2">
              {paginatedCourses.map((course) => (
                <div key={course.id} className="rounded-3xl border border-border bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 text-right">
                      <div className="text-xl font-extrabold text-text-main">{course.name}</div>
                      <div className="mt-1 text-sm text-text-soft">{course.city || '-'}{course.code ? ` | ${course.code}` : ''}</div>
                    </div>
                    <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">{statusLabel(course.status)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-right text-sm">
                    <div className="rounded-2xl border border-border bg-background p-3"><div className="text-xs text-text-soft">المشروع</div><div className="font-bold text-text-main">{course.operationalProject?.name || '-'}</div></div>
                    <div className="rounded-2xl border border-border bg-background p-3"><div className="text-xs text-text-soft">المسؤول</div><div className="font-bold text-text-main">{employeeName(course.primaryEmployee)}</div></div>
                    <div className="rounded-2xl border border-border bg-background p-3"><div className="text-xs text-text-soft">الفريق المساند</div><div className="font-bold text-text-main">{(course.supportingTeam || []).map((x) => employeeName(x.user)).join('، ') || '-'}</div></div>
                    <div className="rounded-2xl border border-border bg-background p-3"><div className="text-xs text-text-soft">الفترة</div><div className="font-bold text-text-main">{formatDate(course.startDate)} - {formatDate(course.endDate)}</div></div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button onClick={() => router.push(`/courses/${course.id}`)} className="rounded-2xl border border-border px-3 py-2 text-xs font-bold text-text-main hover:bg-background">فتح</button>
                    {canManageCourse(course) && (
                      <button onClick={() => router.push(`/courses/${course.id}/edit`)} className="rounded-2xl border border-border px-3 py-2 text-xs font-bold text-text-main hover:bg-background">تعديل</button>
                    )}
                    {(role === 'MANAGER' || role === 'PROJECT_SUPERVISOR') && (
                      <button onClick={() => handleReassign(course.id)} disabled={busyId === course.id} className="rounded-2xl border border-border px-3 py-2 text-xs font-bold text-text-main hover:bg-background disabled:opacity-50">نقل</button>
                    )}
                    {(role === 'MANAGER' || role === 'PROJECT_SUPERVISOR') && (
                      <button onClick={() => handleArchive(course.id)} disabled={busyId === course.id} className="rounded-2xl border border-border px-3 py-2 text-xs font-bold text-text-main hover:bg-background disabled:opacity-50">أرشفة</button>
                    )}
                    {canDeleteCourse(course) && (
                      <button onClick={() => handleDelete(course.id)} disabled={busyId === course.id} className="rounded-2xl border border-danger/20 px-3 py-2 text-xs font-bold text-danger hover:bg-red-50 disabled:opacity-50">حذف</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 rounded-3xl border border-border bg-white px-4 py-4 shadow-card md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-text-soft">عرض {Math.min((page - 1) * PAGE_SIZE + 1, filteredCourses.length)} إلى {Math.min(page * PAGE_SIZE, filteredCourses.length)} من {filteredCourses.length}</div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background disabled:opacity-50">السابق</button>
                <div className="rounded-xl bg-background px-4 py-2 text-sm font-bold text-text-main">{page} / {totalPages}</div>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background disabled:opacity-50">التالي</button>
              </div>
            </div>
          </section>
        )}
      </div>
    </MainLayout>
  );
}
