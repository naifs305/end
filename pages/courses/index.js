import { isAdminRole } from '../../lib/roles';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import MainLayout from '../../components/layout/MainLayout';
import Link from 'next/link';
import toast from 'react-hot-toast';

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M23 3H1v5h22V3Z" />
      <path d="M10 12h4" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
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

    setFilters({
      status: router.query.status || '',
    });
  }, [router.isReady, router.query.status]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/users', {
        params: { _t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const rows = Array.isArray(res.data) ? res.data : [];
      setUsers(rows.filter((u) => u.roles?.includes('EMPLOYEE')));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    setLoading(true);

    try {
      const listRes = await api.get('/courses', {
        params: {
          ...(filters.status ? { status: filters.status } : {}),
          _t: Date.now(),
        },
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const baseRows = Array.isArray(listRes.data) ? listRes.data : [];
      const activeRows = baseRows.filter((c) => c.status !== 'ARCHIVED');

      const hydratedRows = await Promise.all(
        activeRows.map(async (course) => {
          try {
            const detailRes = await api.get(`/courses/${course.id}`, {
              params: { _t: Date.now() },
              headers: {
                'Cache-Control': 'no-cache',
                Pragma: 'no-cache',
              },
            });
            return detailRes.data;
          } catch {
            return course;
          }
        }),
      );

      setCourses(hydratedRows);
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
  }, [router.isReady, router.asPath, fetchCourses]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [activeRole, fetchUsers]);

  useEffect(() => {
    const handleFocus = () => {
      fetchCourses();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchCourses]);

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

    if (!primaryEmployeeId) {
      toast.error('اختر الموظف أولًا');
      return;
    }

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

  const handleEdit = (courseId) => {
    router.push(`/courses/${courseId}/edit`);
  };

  const canEditCourse = (course) => {
    if (isAdmin) return true;
    if (activeRole === 'EMPLOYEE' && course.status === 'PREPARATION') return true;
    return false;
  };

  const canDeleteCourse = (course) => {
    if (isAdmin) return true;
    if (activeRole === 'EMPLOYEE' && course.status === 'PREPARATION') return true;
    return false;
  };

  const getStatusLabel = (status) => {
    const labels = {
      PREPARATION: 'قيد الإعداد',
      EXECUTION: 'قيد التنفيذ',
      AWAITING_CLOSURE: 'بانتظار الإغلاق',
      CLOSED: 'مغلقة',
      ARCHIVED: 'مؤرشفة',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    const classes = {
      PREPARATION: 'bg-primary-light text-primary',
      EXECUTION: 'bg-amber-50 text-warning',
      AWAITING_CLOSURE: 'bg-red-50 text-danger',
      CLOSED: 'bg-emerald-50 text-success',
      ARCHIVED: 'bg-gray-100 text-text-soft',
    };
    return classes[status] || 'bg-gray-100 text-text-soft';
  };

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('ar-SA');
  };

  const formatLocationType = (value) => {
    const map = {
      INTERNAL: 'داخلي',
      EXTERNAL: 'خارجي',
      REMOTE: 'عن بُعد',
    };
    return map[value] || value || 'غير محدد';
  };

  const renderCourseActions = (course, compact = false) => (
    <>
      {(canEditCourse(course) || canDeleteCourse(course)) && (
        <div className={`flex items-center gap-2 ${compact ? '' : 'mb-3'}`}>
          {canEditCourse(course) && (
            <button
              onClick={() => handleEdit(course.id)}
              disabled={actionLoadingId === course.id}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-white text-primary transition hover:border-primary hover:bg-primary-light disabled:opacity-50"
              title="تعديل الدورة"
            >
              <EditIcon />
            </button>
          )}

          {canDeleteCourse(course) && (
            <button
              onClick={() => handleDelete(course.id)}
              disabled={actionLoadingId === course.id}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-danger/20 bg-white text-danger transition hover:bg-red-50 disabled:opacity-50"
              title="حذف الدورة"
            >
              <DeleteIcon />
            </button>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3">
          <select
            className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            value={reassignSelections[course.id] || ''}
            onChange={(e) =>
              setReassignSelections((prev) => ({
                ...prev,
                [course.id]: e.target.value,
              }))
            }
          >
            <option value="">اختر موظفًا لنقل الدورة</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleReassign(course.id)}
            disabled={actionLoadingId === course.id}
            className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            نقل الدورة
          </button>

          {course.status === 'CLOSED' && (
            <button
              onClick={() => handleArchive(course.id)}
              disabled={actionLoadingId === course.id}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary disabled:opacity-50"
            >
              <ArchiveIcon />
              <span>نقل إلى الأرشيف</span>
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-text-main">الدورات النشطة</h1>
              <p className="mt-2 text-sm text-text-soft">
                متابعة الدورات الجارية ضمن الهوية المؤسسية للمنصة
              </p>
            </div>

            <div className="flex gap-2">
              {isAdmin && (
                <Link href="/archive">
                  <button className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary">
                    الأرشيف
                  </button>
                </Link>
              )}

              {activeRole === 'EMPLOYEE' && (
                <Link href="/courses/create">
                  <button className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-soft transition hover:bg-primary-dark">
                    + دورة جديدة
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white p-4 shadow-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <select
              className="w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
              value={filters.status}
              onChange={(e) => setFilters({ status: e.target.value })}
            >
              <option value="">كل الحالات</option>
              <option value="PREPARATION">قيد الإعداد</option>
              <option value="EXECUTION">قيد التنفيذ</option>
              <option value="AWAITING_CLOSURE">بانتظار الإغلاق</option>
              <option value="CLOSED">مغلقة</option>
            </select>

            <div className="md:col-span-2" />

            <div className="md:col-span-2 flex items-center justify-start md:justify-end">
              <div className="inline-flex rounded-2xl border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    viewMode === 'grid'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-text-main hover:bg-white'
                  }`}
                >
                  <GridIcon />
                  <span>بطاقات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                    viewMode === 'table'
                      ? 'bg-primary text-white shadow-soft'
                      : 'text-text-main hover:bg-white'
                  }`}
                >
                  <ListIcon />
                  <span>جدول</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-border bg-white p-8 text-center text-sm font-medium text-text-soft shadow-card">
            جاري التحميل...
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <Link href={`/courses/${course.id}`}>
                  <div className="cursor-pointer p-6">
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <h3 className="text-lg font-extrabold leading-8 text-text-main">
                        {course.name || '-'}
                      </h3>

                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(course.status)}`}
                      >
                        {getStatusLabel(course.status)}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-2xl bg-background px-4 py-3 text-sm text-text-soft">
                        {course.beneficiaryEntity || 'غير محدد'} - {course.city || 'غير محدد'}
                      </div>

                      <div className="text-sm text-text-main">
                        <span className="font-bold text-primary">المسؤول:</span>{' '}
                        {course.primaryEmployee?.firstName} {course.primaryEmployee?.lastName}
                      </div>

                      <div className="text-sm text-text-soft">
                        <span className="font-bold text-text-main">مقر التنفيذ:</span>{' '}
                        {formatLocationType(course.locationType)}
                      </div>

                      <div className="text-sm text-text-soft">
                        <span className="font-bold text-text-main">تاريخ البداية:</span>{' '}
                        {formatDate(course.startDate)}
                      </div>
                    </div>
                  </div>
                </Link>

                <div className="mt-auto px-6 pb-6">{renderCourseActions(course)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-background">
                  <tr className="text-right text-text-soft">
                    <th className="px-4 py-3 font-bold">اسم الدورة</th>
                    <th className="px-4 py-3 font-bold">الحالة</th>
                    <th className="px-4 py-3 font-bold">المدينة</th>
                    <th className="px-4 py-3 font-bold">مقر التنفيذ</th>
                    <th className="px-4 py-3 font-bold">المسؤول</th>
                    <th className="px-4 py-3 font-bold">تاريخ البداية</th>
                    <th className="px-4 py-3 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-text-soft">
                        لا توجد دورات
                      </td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr
                        key={course.id}
                        className="border-t border-border transition hover:bg-background"
                      >
                        <td className="px-4 py-4">
                          <Link href={`/courses/${course.id}`}>
                            <span className="cursor-pointer font-bold text-text-main hover:text-primary">
                              {course.name || '-'}
                            </span>
                          </Link>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${getStatusClass(course.status)}`}
                          >
                            {getStatusLabel(course.status)}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-text-soft">{course.city || '-'}</td>
                        <td className="px-4 py-4 text-text-soft">
                          {formatLocationType(course.locationType)}
                        </td>
                        <td className="px-4 py-4 text-text-soft">
                          {`${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-'}
                        </td>
                        <td className="px-4 py-4 text-text-soft">{formatDate(course.startDate)}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            {canEditCourse(course) && (
                              <button
                                onClick={() => handleEdit(course.id)}
                                disabled={actionLoadingId === course.id}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-primary transition hover:border-primary hover:bg-primary-light disabled:opacity-50"
                                title="تعديل الدورة"
                              >
                                <EditIcon />
                              </button>
                            )}

                            {canDeleteCourse(course) && (
                              <button
                                onClick={() => handleDelete(course.id)}
                                disabled={actionLoadingId === course.id}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-danger/20 bg-white text-danger transition hover:bg-red-50 disabled:opacity-50"
                                title="حذف الدورة"
                              >
                                <DeleteIcon />
                              </button>
                            )}

                            {isAdmin && course.status === 'CLOSED' && (
                              <button
                                onClick={() => handleArchive(course.id)}
                                disabled={actionLoadingId === course.id}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white text-text-main transition hover:border-primary hover:bg-primary-light hover:text-primary disabled:opacity-50"
                                title="نقل إلى الأرشيف"
                              >
                                <ArchiveIcon />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}