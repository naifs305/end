import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText, RotateCcw, FolderOpen, ArrowLeft, Archive as ArchiveIcon } from 'lucide-react';
import useAuth from '../context/AuthContext';
import { isAdminRole } from '../lib/roles';
import { useTranslation } from '../lib/i18n';

export default function Archive() {
  const { activeRole } = useAuth();
  const { t, locale } = useTranslation();
  const isSupervisor = activeRole === 'PROJECT_SUPERVISOR';
  const isAdmin = isAdminRole(activeRole) || isSupervisor;
  const [courses, setCourses] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

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

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const paginatedCourses = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCourses.slice(start, start + PAGE_SIZE);
  }, [filteredCourses, page]);

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
    return new Date(date).toLocaleDateString(locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory');
  };

  const getStatusLabel = (status) => {
    const key = status === 'IN_PROGRESS' ? 'EXECUTION' : status;
    return t(`courseStatus.${key}`);
  };

  const getProjectName = (course) => {
    return (
      course.operationalProject?.name ||
      projects.find((p) => p.id === course.operationalProjectId)?.name ||
      '-'
    );
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');

      const data = filteredCourses.map((course) => ({
        [t('archive.col.courseName')]: course.name || '',
        [t('archive.col.code')]: course.code || '',
        [t('archive.col.project')]: getProjectName(course),
        [t('archive.col.city')]: course.city || '',
        [t('archive.col.type')]: course.courseType === 'internal' ? t('archive.typeInternal') : t('archive.typeExternal'),
        [t('archive.col.status')]: getStatusLabel(course.status),
        [t('archive.col.startDate')]: formatDate(course.startDate),
        [t('archive.col.endDate')]: formatDate(course.endDate),
        [t('archive.col.trainees')]: course.numTrainees || 0,
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

      XLSX.utils.book_append_sheet(workbook, worksheet, t('archive.sheetName'));
      XLSX.writeFile(workbook, 'course-closure-archive.xlsx');
    } catch (error) {
      console.error(error);
      toast.error(t('common.error'));
    }
  };

  const exportToPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFontSize(16);
      doc.text(isAdmin ? t('archive.titleAdmin') : t('archive.titleEmployee'), 14, 15);

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
          fillColor: [37, 60, 50],
          textColor: 255,
        },
        alternateRowStyles: {
          fillColor: [247, 247, 245],
        },
        margin: { top: 22, right: 10, bottom: 10, left: 10 },
      });

      doc.save(isAdmin ? 'course-closure-archive.pdf' : 'my-course-archive.pdf');
    } catch (error) {
      console.error(error);
      toast.error(t('common.error'));
    }
  };

  if (!['MANAGER', 'PROJECT_SUPERVISOR', 'EMPLOYEE'].includes(activeRole)) {
    return (
      <MainLayout>
        <div className="rounded-2xl border border-danger/20 bg-white p-6 text-danger shadow-card">
          {t('archive.unauthorized')}
        </div>
      </MainLayout>
    );
  }

  const inputClass =
    'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="inline-flex items-center gap-2 text-2xl font-extrabold text-primary">
                <ArchiveIcon size={22} aria-hidden="true" />
                {isAdmin ? t('archive.titleAdmin') : t('archive.titleEmployee')}
              </h1>
              <p className="mt-1 text-sm text-text-soft">
                {isAdmin ? t('archive.subtitleAdmin') : t('archive.subtitleEmployee')}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark"
              >
                <FileSpreadsheet size={16} aria-hidden="true" /> {t('archive.exportExcel')}
              </button>
              <button
                onClick={exportToPDF}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
              >
                <FileText size={16} aria-hidden="true" /> {t('archive.exportPdf')}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard title={t('archive.statTotal')} value={stats.total} accent />
          <StatCard title={t('archive.statClosed')} value={stats.closed} />
          <StatCard title={t('archive.statArchived')} value={stats.archived} />
          <StatCard title={t('archive.statInternal')} value={stats.internal} />
          <StatCard title={t('archive.statExternal')} value={stats.external} />
        </div>

        <div className="rounded-2xl border border-border bg-white p-4 md:p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-primary">{t('archive.filtersTitle')}</h2>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main transition hover:bg-background"
            >
              <RotateCcw size={15} aria-hidden="true" /> {t('archive.resetFilters')}
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
              placeholder={t('archive.searchPlaceholder')}
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
                <option value="">{t('archive.allProjects')}</option>
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
              <option value="">{t('archive.allStatuses')}</option>
              <option value="CLOSED">{t('courseStatus.CLOSED')}</option>
              <option value="ARCHIVED">{t('courseStatus.ARCHIVED')}</option>
            </select>

            <input
              type="number"
              name="year"
              placeholder={t('archive.year')}
              value={filters.year}
              onChange={handleChange}
              className={inputClass}
            />

            <input
              type="text"
              name="city"
              placeholder={t('archive.city')}
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
              <option value="">{t('archive.allTypes')}</option>
              <option value="internal">{t('archive.typeInternal')}</option>
              <option value="external">{t('archive.typeExternal')}</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="border-b border-border p-4">
            <h2 className="text-lg font-extrabold text-primary">
              {isAdmin ? t('archive.logTitleAdmin') : t('archive.logTitleEmployee')}
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-text-soft">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-background border-b border-border">
                  <tr className="text-start">
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.courseName')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.code')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.project')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.city')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.type')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.status')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('archive.col.closureDate')}</th>
                    <th className="px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-text-soft/60">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-12 text-center text-text-soft">
                        {t('archive.noResults')}
                      </td>
                    </tr>
                  ) : (
                    paginatedCourses.map((course) => (
                      <tr key={course.id} className="border-t border-border transition hover:bg-background">
                        <td className="px-4 py-3 font-bold text-text-main max-w-[200px]">
                          <Link href={`/courses/${course.id}`} className="line-clamp-1 hover:text-primary transition">
                            {course.name || '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-soft font-mono">{course.code || '—'}</td>
                        <td className="px-4 py-3 text-xs text-text-soft">{getProjectName(course)}</td>
                        <td className="px-4 py-3 text-xs text-text-soft">{course.city || '—'}</td>
                        <td className="px-4 py-3 text-xs text-text-soft">
                          {course.courseType === 'internal' ? t('archive.typeInternal') : t('archive.typeExternal')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            course.status === 'ARCHIVED'
                              ? 'bg-border/60 text-text-soft border-border'
                              : 'bg-forest-50 text-accent border-accent/20'
                          }`}>
                            {getStatusLabel(course.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-text-soft">{formatDate(course.endDate)}</td>
                        <td className="px-4 py-3">
                          <Link href={`/courses/${course.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-text-main hover:border-primary hover:text-primary transition">
                            <FolderOpen size={13} aria-hidden="true" /> {t('common.view')}
                            <ArrowLeft size={12} aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {filteredCourses.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-text-soft">
                {t('archive.pageRange', {
                  from: Math.min((page - 1) * PAGE_SIZE + 1, filteredCourses.length),
                  to: Math.min(page * PAGE_SIZE, filteredCourses.length),
                  total: filteredCourses.length,
                })}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:bg-background disabled:opacity-50">{t('common.previous')}</button>
                <div className="rounded-xl bg-background px-4 py-2 text-sm font-bold text-text-main">{page} / {totalPages}</div>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:bg-background disabled:opacity-50">{t('common.next')}</button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </MainLayout>
  );
}

function StatCard({ title, value, accent }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${accent ? 'border-primary/20 bg-primary-light/50' : 'border-border'}`}>
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-text-soft/60">{title}</div>
      <div className={`text-2xl font-extrabold ${accent ? 'text-primary' : 'text-text-main'}`}>{value}</div>
    </div>
  );
}
