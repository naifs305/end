import { isAdminRole } from '../../lib/roles';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import Link from 'next/link';
import toast from 'react-hot-toast';

function EditIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></svg>;
}
function DeleteIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
}
function ArchiveIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" /><path d="M23 3H1v5h22V3Z" /><path d="M10 12h4" /></svg>;
}
function GridIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></svg>;
}
function ListIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>;
}

export default function Courses() {
  const router = useRouter();
  const { activeRole } = useAuth();
  const isAdmin = isAdminRole(activeRole);

  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '' });
  const [reassignSelections, setReassignSelections] = useState({});
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    if (!router.isReady) return;
    setFilters({ status: router.query.status || '' });
  }, [router.isReady, router.query.status]);

  const fetchUsers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/users');
      const rows = Array.isArray(res.data) ? res.data : [];
      setUsers(rows.filter((u) => u.roles?.includes('EMPLOYEE')));
    } catch (err) {
      console.error(err);
    }
  }, [isAdmin]);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/courses', {
        params: filters.status ? { status: filters.status } : {},
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setCourses(rows.filter((course) => course.status !== 'ARCHIVED'));
    } catch (err) {
      console.error(err);
      toast.error('تعذر تحميل الدورات');
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => {
    if (!router.isReady) return;
    fetchCourses();
  }, [router.isReady, fetchCourses]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleArchive = async (id) => {
    if (!confirm('هل أنت متأكد من أرشفة هذه الدورة؟')) return;
    try {
      setActionLoadingId(id);
      await api.put(`/courses/${id}/archive`);
      toast.success('تمت الأرشفة');
      await fetchCourses();
    } catch (e) {
      toast.error(e.response?.data?.message || 'فشل في الأرشفة');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الدورة؟')) return;
    try {
      setActionLoadingId(id);
      await api.delete(`/courses/${id}`);
      toast.success('تم حذف الدورة');
      await fetchCourses();
    } catch (e) {
      toast.error(e.response?.data?.message || 'فشل في حذف الدورة');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReassign = async (courseId) => {
    const primaryEmployeeId = reassignSelections[courseId];
    if (!primaryEmployeeId) return toast.error('اختر الموظف أولًا');
    try {
      setActionLoadingId(courseId);
      await api.put(`/courses/${courseId}/reassign`, { primaryEmployeeId });
      toast.success('تم نقل الدورة بنجاح');
      await fetchCourses();
    } catch (e) {
      toast.error(e.response?.data?.message || 'فشل في نقل الدورة');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-text-main">الدورات النشطة</h1>
              <p className="mt-2 text-sm text-text-soft">متابعة الدورات الجارية ضمن الهوية المؤسسية للمنصة</p>
            </div>
            <Link href="/archive" className="rounded-2xl border border-border bg-white px-5 py-3 text-sm font-bold text-text-main transition hover:bg-background">الأرشيف</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-2">
              <button onClick={() => setViewMode('list')} className={`rounded-xl px-5 py-2 text-sm font-bold ${viewMode === 'list' ? 'bg-primary text-white' : 'text-text-main'}`}><span className="inline-flex items-center gap-2"><ListIcon /> جدول</span></button>
              <button onClick={() => setViewMode('grid')} className={`rounded-xl px-5 py-2 text-sm font-bold ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-text-main'}`}><span className="inline-flex items-center gap-2"><GridIcon /> بطاقات</span></button>
            </div>
            <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} className="rounded-2xl border border-border bg-white px-4 py-3 text-sm">
              <option value="">كل الحالات</option>
              <option value="PREPARATION">الإعداد</option>
              <option value="EXECUTION">التنفيذ</option>
              <option value="AWAITING_CLOSURE">بانتظار الإقفال</option>
              <option value="CLOSED">مقفلة</option>
            </select>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          {loading ? (
            <div className="py-14 text-center text-text-soft">جاري التحميل...</div>
          ) : courses.length === 0 ? (
            <div className="py-14 text-center text-text-soft">لا توجد دورات حالياً</div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <div key={course.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-text-main">{course.name}</div>
                      <div className="mt-1 text-xs text-text-soft">{course.operationalProject?.name || '-'}</div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-primary">{course.status}</div>
                  </div>
                  <div className="space-y-1 text-sm text-text-soft">
                    <div>المدينة: {course.city}</div>
                    <div>المستفيد: {course.beneficiaryEntity || '-'}</div>
                    <div>المتدربون: {course.numTrainees}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/courses/${course.id}`} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main">فتح</Link>
                    <Link href={`/courses/${course.id}/edit`} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main inline-flex items-center gap-1"><EditIcon /> تعديل</Link>
                    {isAdmin && <button onClick={() => handleArchive(course.id)} disabled={actionLoadingId === course.id} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main inline-flex items-center gap-1"><ArchiveIcon /> أرشفة</button>}
                    <button onClick={() => handleDelete(course.id)} disabled={actionLoadingId === course.id} className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 inline-flex items-center gap-1"><DeleteIcon /> حذف</button>
                  </div>
                  {isAdmin && users.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-2 text-xs font-bold text-text-soft">إعادة الإسناد</div>
                      <div className="flex gap-2">
                        <select value={reassignSelections[course.id] || ''} onChange={(e) => setReassignSelections((prev) => ({ ...prev, [course.id]: e.target.value }))} className="flex-1 rounded-xl border border-border bg-white px-3 py-2 text-xs">
                          <option value="">اختر الموظف</option>
                          {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
                        </select>
                        <button onClick={() => handleReassign(course.id)} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white">نقل</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-text-soft">
                    <th className="px-4 py-3">الدورة</th>
                    <th className="px-4 py-3">المشروع</th>
                    <th className="px-4 py-3">الحالة</th>
                    <th className="px-4 py-3">المدينة</th>
                    <th className="px-4 py-3">المتدربون</th>
                    <th className="px-4 py-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} className="border-b border-border">
                      <td className="px-4 py-3 font-bold text-text-main">{course.name}</td>
                      <td className="px-4 py-3 text-text-soft">{course.operationalProject?.name || '-'}</td>
                      <td className="px-4 py-3 text-text-soft">{course.status}</td>
                      <td className="px-4 py-3 text-text-soft">{course.city}</td>
                      <td className="px-4 py-3 text-text-soft">{course.numTrainees}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/courses/${course.id}`} className="text-primary hover:underline">فتح</Link>
                          <Link href={`/courses/${course.id}/edit`} className="text-primary hover:underline">تعديل</Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
