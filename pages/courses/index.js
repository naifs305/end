import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import axios from '../../lib/axios';
import { canCreateCourse, getDefaultRole } from '../../lib/roles';

function normalizeCourses(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.courses)) return payload.courses;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getCourseTitle(course) {
  return (
    course?.title ||
    course?.name ||
    course?.courseTitle ||
    course?.courseName ||
    'دورة بدون عنوان'
  );
}

function getCourseStatus(course) {
  return course?.statusLabel || course?.status || course?.phase || 'غير محدد';
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeRole, setActiveRole] = useState('EMPLOYEE');

  useEffect(() => {
    try {
      const currentRole = localStorage.getItem('activeRole');
      const cachedUser = JSON.parse(localStorage.getItem('cachedUser') || 'null');
      setActiveRole(currentRole || getDefaultRole(cachedUser));
    } catch (e) {
      setActiveRole('EMPLOYEE');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadCourses() {
      setLoading(true);
      try {
        const response = await axios.get('/api/courses');
        if (!mounted) return;
        setCourses(normalizeCourses(response.data));
      } catch (error) {
        if (!mounted) return;
        setCourses([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCourses();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredCourses = useMemo(() => {
    if (statusFilter === 'ALL') return courses;
    return courses.filter((course) => (course?.status || course?.phase || '') === statusFilter);
  }, [courses, statusFilter]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="text-right">
              <h1 className="text-3xl font-bold text-slate-800">الدورات النشطة</h1>
              <p className="mt-2 text-sm text-slate-500">متابعة الدورات الجارية ضمن الهوية المؤسسية للمنصة</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canCreateCourse(activeRole) && (
                <button
                  type="button"
                  onClick={() => router.push('/courses/create')}
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
                >
                  إضافة دورة جديدة
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push('/archive')}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                الأرشيف
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-2xl bg-teal-700 px-4 py-3 text-sm font-bold text-white"
              >
                بطاقات
              </button>
              <button
                type="button"
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700"
              >
                جدول
              </button>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-right text-sm font-medium text-slate-700 md:w-56"
            >
              <option value="ALL">كل الحالات</option>
              <option value="DRAFT">مسودة</option>
              <option value="IN_PROGRESS">قيد التنفيذ</option>
              <option value="CLOSED">مقفلة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-slate-200 p-16 text-center text-lg text-slate-400">
              جاري التحميل...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 p-16 text-center text-lg text-slate-400">
              لا توجد دورات حاليًا
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => router.push(`/courses/${course.id}`)}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-right transition hover:border-teal-600 hover:bg-white"
                >
                  <div className="text-lg font-bold text-slate-800">{getCourseTitle(course)}</div>
                  <div className="mt-2 text-sm text-slate-500">{course?.location || course?.venue || 'غير محدد'}</div>
                  <div className="mt-4 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                    {getCourseStatus(course)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
