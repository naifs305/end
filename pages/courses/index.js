
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import useAuth from '../../context/AuthContext';
import { canCreateCourse, normalizeRole } from '../../lib/roles';

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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [busyId, setBusyId] = useState(null);

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

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'ALL') return courses;
    return courses.filter((course) => course.status === statusFilter);
  }, [courses, statusFilter]);

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
              <p className="mt-2 text-sm text-text-soft">متابعة الدورات الجارية ضمن الهوية المؤسسية للمنصة</p>
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
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-border px-4 py-3 text-right text-sm md:w-56">
              <option value="ALL">كل الحالات</option>
              <option value="PREPARATION">قيد الإعداد</option>
              <option value="EXECUTION">قيد التنفيذ</option>
              <option value="AWAITING_CLOSURE">بانتظار الإقفال</option>
              <option value="CLOSED">مقفلة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-border bg-background p-16 text-center text-text-soft">جاري التحميل...</div>
          ) : filteredCourses.length === 0 ? (
            <div className="rounded-3xl border border-border bg-background p-16 text-center text-text-soft">لا توجد دورات حاليًا</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => (
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
          )}
        </section>
      </div>
    </MainLayout>
  );
}
