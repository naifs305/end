import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import Link from 'next/link';
import useAuth from '../context/AuthContext';
import { isAdminRole } from '../lib/roles';

export default function Archive() {
  const { activeRole } = useAuth();
  const isAdmin = isAdminRole(activeRole); // مدير أو مشرف
  const [courses, setCourses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    search: '',
    projectId: '',
    status: '',
    year: '',
    city: '',
    courseType: '',
  });

  useEffect(() => {
    if (activeRole) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const requests = isAdmin
        ? [api.get('/courses/archived'), api.get('/projects')]
        : [api.get('/courses/archived')];

      const responses = await Promise.all(requests);

      setCourses(responses[0]?.data || []);
      setProjects(isAdmin ? responses[1]?.data || [] : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesSearch =
        !filters.search ||
        course.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        course.code?.toLowerCase().includes(filters.search.toLowerCase());

      const matchesProject =
        activeRole !== 'MANAGER' ||
        !filters.projectId ||
        course.operationalProjectId === filters.projectId;

      const matchesStatus = !filters.status || course.status === filters.status;

      const matchesYear =
        !filters.year ||
        new Date(course.endDate).getFullYear().toString() === filters.year;

      const matchesCity =
        !filters.city ||
        course.city?.toLowerCase().includes(filters.city.toLowerCase());

      const matchesCourseType =
        !filters.courseType || course.courseType === filters.courseType;

      return (
        matchesSearch &&
        matchesProject &&
        matchesStatus &&
        matchesYear &&
        matchesCity &&
        matchesCourseType
      );
    });
  }, [courses, filters, activeRole]);

  const stats = useMemo(() => {
    return {
      total: filteredCourses.length,
      archived: filteredCourses.filter((c) => c.status === 'ARCHIVED').length,
      closed: filteredCourses.filter((c) => c.status === 'CLOSED').length,
      internal: filteredCourses.filter((c) => c.courseType === 'internal').length,
      external: filteredCourses.filter((c) => c.courseType === 'external').length,
    };
  }, [filteredCourses]);

  const resetFilters = () => {
    setFilters({
      search: '',
      projectId: '',
      status: '',
      year: '',
      city: '',
      courseType: '',
    });
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('ar-SA');
  };

  const getStatusLabel = (status) => {
    const map = {
      PREPARATION: 'قيد الإعداد',
      EXECUTION: 'قيد التنفيذ',
      AWAITING_CLOSURE: 'بانتظار الإغلاق',
      CLOSED: 'مغلقة',
      ARCHIVED: 'مؤرشفة',
    };
    return map[status] || status;
  };

  const getProjectName = (course) => {
    return (
      course.operationalProject?.name ||
      projects.find((p) => p.id === course.operationalProjectId)?.name ||
      '-'
    );
  };

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');

    const data = filteredCourses.map((course) => ({
      'اسم الدورة': course.name || '',
      'الكود': course.code || '',
      'المشروع': getProjectName(course),
      'المدينة': course.city || '',
      'نوع الدورة': course.courseType === 'internal' ? 'داخلية' : 'خارجية',
      'الحالة': getStatusLabel(course.status),
      'تاريخ البداية': formatDate(course.startDate),
      'تاريخ النهاية': formatDate(course.endDate),
      'عدد المتدربين': course.numTrainees || 0,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    worksheet['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'الأرشيف');
    XLSX.writeFile(workbook, 'course-closure-archive.xlsx');
  };

  const exportToPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFontSize(16);
    doc.text(isAdmin ? 'Course Closure Archive' : 'My Course Archive', 14, 15);

    const tableRows = filteredCourses.map((course) => [
      course.name || '-',
      course.code || '-',
      getProjectName(course),
      course.city || '-',
      course.courseType === 'internal' ? 'Internal' : 'External',
      getStatusLabel(course.status),
      formatDate(course.endDate),
    ]);

    autoTable(doc, {
      startY: 22,
      head: [[
        'Course Name',
        'Code',
        'Project',
        'City',
        'Type',
        'Status',
        'Closure Date',
      ]],
      body: tableRows,
      styles: {
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
      },
      headStyles: {
        fillColor: [0, 108, 109],
        textColor: 255,
      },
      alternateRowStyles: {
        fillColor: [247, 247, 245],
      },
      margin: { top: 22, right: 10, bottom: 10, left: 10 },
    });

    doc.save(isAdmin ? 'course-closure-archive.pdf' : 'my-course-archive.pdf');
  };

  if (activeRole !== 'MANAGER' && activeRole !== 'EMPLOYEE') {
    return (
      <MainLayout>
        <div className="rounded-3xl border border-danger/20 bg-white p-6 text-danger shadow-card">
          غير مصرح لك بالدخول إلى هذه الصفحة.
        </div>
      </MainLayout>
    );
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">
                {isAdmin ? 'أرشيف الإقفالات' : 'أرشيفي'}
              </h1>
              <p className="mt-1 text-sm text-text-soft">
                {isAdmin
                  ? 'عرض وأرشفة الدورات المغلقة والمؤرشفة'
                  : 'عرض دوراتك المغلقة والمؤرشفة'}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark"
              >
                تصدير Excel
              </button>
              <button
                onClick={exportToPDF}
                className="rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
              >
                تصدير PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard title="إجمالي الأرشيف" value={stats.total} />
          <StatCard title="مؤرشفة" value={stats.archived} />
          <StatCard title="مغلقة" value={stats.closed} />
          <StatCard title="داخلية" value={stats.internal} />
          <StatCard title="خارجية" value={stats.external} />
        </div>

        <div className="rounded-3xl border border-border bg-white p-4 md:p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-primary">فلاتر الأرشيف</h2>
            <button
              onClick={resetFilters}
              className="rounded-2xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main transition hover:bg-background"
            >
              إعادة تعيين
            </button>
          </div>

          <div
            className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${
              isAdmin ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
            }`}
          >
            <input
              type="text"
              name="search"
              placeholder="بحث باسم الدورة أو الكود"
              value={filters.search}
              onChange={handleChange}
              className={inputClass}
            />

            {isAdmin && (
              <select
                name="projectId"
                value={filters.projectId}
                onChange={handleChange}
                className={inputClass}
              >
                <option value="">كل المشاريع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}

            <select
              name="status"
              value={filters.status}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">كل الحالات</option>
              <option value="CLOSED">مغلقة</option>
              <option value="ARCHIVED">مؤرشفة</option>
            </select>

            <input
              type="number"
              name="year"
              placeholder="السنة"
              value={filters.year}
              onChange={handleChange}
              className={inputClass}
            />

            <input
              type="text"
              name="city"
              placeholder="المدينة"
              value={filters.city}
              onChange={handleChange}
              className={inputClass}
            />

            <select
              name="courseType"
              value={filters.courseType}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">كل الأنواع</option>
              <option value="internal">داخلية</option>
              <option value="external">خارجية</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-extrabold text-primary">
              {isAdmin ? 'سجل الإقفالات' : 'سجل دوراتي المؤرشفة'}
            </h2>
          </div>

          {loading ? (
            <div className="p-6 text-text-soft">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-background">
                  <tr className="text-right text-text-soft">
                    <th className="px-6 py-4 font-bold">الدورة</th>
                    <th className="px-6 py-4 font-bold">الكود</th>
                    <th className="px-6 py-4 font-bold">المشروع</th>
                    <th className="px-6 py-4 font-bold">المدينة</th>
                    <th className="px-6 py-4 font-bold">النوع</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold">تاريخ الإغلاق</th>
                    <th className="px-6 py-4 font-bold">الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-text-soft">
                        لا توجد نتائج في الأرشيف
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((course) => (
                      <tr
                        key={course.id}
                        className="border-t border-border transition hover:bg-background"
                      >
                        <td className="px-6 py-4 font-bold text-text-main">{course.name || '-'}</td>
                        <td className="px-6 py-4 text-text-soft">{course.code || '-'}</td>
                        <td className="px-6 py-4 text-text-soft">{getProjectName(course)}</td>
                        <td className="px-6 py-4 text-text-soft">{course.city || '-'}</td>
                        <td className="px-6 py-4 text-text-soft">
                          {course.courseType === 'internal' ? 'داخلية' : 'خارجية'}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              course.status === 'ARCHIVED'
                                ? 'bg-primary-light text-primary'
                                : 'bg-[#fcf8f1] text-[#8c6b2a]'
                            }`}
                          >
                            {getStatusLabel(course.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-soft">{formatDate(course.endDate)}</td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/courses/${course.id}`}
                            className="font-bold text-primary hover:text-primary-dark"
                          >
                            عرض
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-3xl border border-border bg-white p-4 shadow-card">
      <div className="mb-1 text-sm font-medium text-text-soft">{title}</div>
      <div className="text-2xl font-extrabold text-primary">{value}</div>
    </div>
  );
}