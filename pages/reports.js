import { isAdminRole } from '../lib/roles';
import React, { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';

const REPORT_KEYS = ['opening_report', 'closing_report', 'report'];
const VISIBLE_REPORT_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'RETURNED', 'REJECTED'];

function getReportTypeLabel(key) {
  if (key === 'opening_report') return 'تقرير افتتاح الدورة';
  if (key === 'closing_report' || key === 'report') return 'تقرير اختتام الدورة';
  return 'تقرير';
}

export default function ReportsPage() {
  const { activeRole } = useAuth();
  const isAdmin = isAdminRole(activeRole);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    presenter: '',
    locationType: '',
    startDateFrom: '',
    startDateTo: '',
  });

  useEffect(() => {
    fetchData();
  }, [activeRole]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const coursesRes = await api.get('/courses');
      const courses = Array.isArray(coursesRes.data) ? coursesRes.data : [];

      const reportRows = courses.flatMap((course) => {
        const closureElements = Array.isArray(course?.closureElements) ? course.closureElements : [];

        return closureElements
          .filter((item) => REPORT_KEYS.includes(item.element?.key) && VISIBLE_REPORT_STATUSES.includes(item.status))
          .map((item) => ({
            id: item.id,
            courseId: course.id,
            courseName: course.name || '-',
            startDate: course.startDate || null,
            endDate: course.endDate || null,
            locationType: course.locationType || '-',
            presenterName: `${course.primaryEmployee?.firstName || ''} ${course.primaryEmployee?.lastName || ''}`.trim() || '-',
            executionAt: item.executionAt || null,
            status: item.status,
            reportType: getReportTypeLabel(item.element?.key),
            reportKey: item.element?.key,
          }));
      });

      setRows(reportRows);
    } catch (error) {
      console.error('Reports load error:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async (trackingId) => {
    try {
      const res = await api.get(`/closure/${trackingId}/export`, {
        responseType: 'text',
        headers: { Accept: 'text/html' },
      });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.');
        return;
      }

      printWindow.document.open();
      printWindow.document.write(res.data);
      printWindow.document.close();
    } catch (error) {
      console.error(error);
      alert('تعذر فتح التقرير');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({ search: '', presenter: '', locationType: '', startDateFrom: '', startDateTo: '' });
  };

  const formatDate = (date) => (date ? new Date(date).toLocaleDateString('ar-SA') : '-');

  const formatLocationType = (value) => ({ INTERNAL: 'داخلي', EXTERNAL: 'خارجي', REMOTE: 'عن بُعد' }[value] || value || '-');

  const presenterOptions = useMemo(() => [...new Set(rows.map((row) => row.presenterName).filter(Boolean))], [rows]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    const matchesSearch = !filters.search || row.courseName?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesPresenter = !filters.presenter || row.presenterName === filters.presenter;
    const matchesLocationType = !filters.locationType || row.locationType === filters.locationType;
    const matchesStartDateFrom = !filters.startDateFrom || (row.startDate && new Date(row.startDate) >= new Date(filters.startDateFrom));
    const matchesStartDateTo = !filters.startDateTo || (row.startDate && new Date(row.startDate) <= new Date(filters.startDateTo));
    return matchesSearch && matchesPresenter && matchesLocationType && matchesStartDateFrom && matchesStartDateTo;
  }), [rows, filters]);

  const stats = useMemo(() => ({
    total: filteredRows.length,
    approved: filteredRows.filter((row) => row.status === 'APPROVED').length,
    pending: filteredRows.filter((row) => row.status === 'PENDING_APPROVAL').length,
  }), [filteredRows]);

  const inputClass = 'w-full rounded-2xl border border-border bg-white p-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-primary">التقارير الميدانية</h1>
              <p className="mt-1 text-sm text-text-soft">
                {isAdmin ? 'عرض جميع التقارير المقدمة مباشرة بعد التسليم' : 'عرض تقاريرك المقدمة'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard title="إجمالي التقارير" value={stats.total} />
          <StatCard title="تقارير معتمدة" value={stats.approved} />
          <StatCard title="تقارير بانتظار الاعتماد" value={stats.pending} />
        </div>

        <div className="rounded-3xl border border-border bg-white p-4 md:p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-primary">الفلاتر</h2>
            <button onClick={resetFilters} className="rounded-2xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main transition hover:bg-background">إعادة تعيين</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input type="text" name="search" value={filters.search} onChange={handleChange} placeholder="بحث باسم الدورة" className={inputClass} />
            <select name="locationType" value={filters.locationType} onChange={handleChange} className={inputClass}>
              <option value="">كل مقرات التنفيذ</option>
              <option value="INTERNAL">داخلي</option>
              <option value="EXTERNAL">خارجي</option>
              <option value="REMOTE">عن بُعد</option>
            </select>
            {isAdmin ? (
              <select name="presenter" value={filters.presenter} onChange={handleChange} className={inputClass}>
                <option value="">كل مقدمي التقارير</option>
                {presenterOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            ) : (
              <input type="text" value="تقاريري فقط" className={`${inputClass} bg-background`} disabled />
            )}
            <input type="date" name="startDateFrom" value={filters.startDateFrom} onChange={handleChange} className={inputClass} />
            <input type="date" name="startDateTo" value={filters.startDateTo} onChange={handleChange} className={inputClass} />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-white shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-extrabold text-primary">سجل التقارير الميدانية</h2>
          </div>

          {loading ? (
            <div className="p-6 text-text-soft">جاري التحميل...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-background">
                  <tr className="text-right text-text-soft">
                    <th className="px-4 py-3 font-bold">م</th>
                    <th className="px-4 py-3 font-bold">اسم الدورة</th>
                    <th className="px-4 py-3 font-bold">نوع التقرير</th>
                    <th className="px-4 py-3 font-bold">تاريخ البداية</th>
                    <th className="px-4 py-3 font-bold">تاريخ النهاية</th>
                    <th className="px-4 py-3 font-bold">مقر التنفيذ</th>
                    <th className="px-4 py-3 font-bold">اسم مقدم التقرير</th>
                    <th className="px-4 py-3 font-bold">طباعة التقرير</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan="8" className="px-4 py-8 text-center text-text-soft">لا توجد تقارير</td></tr>
                  ) : (
                    filteredRows.map((row, index) => (
                      <tr key={row.id} className="border-t border-border hover:bg-background transition">
                        <td className="px-4 py-3 text-text-soft">{index + 1}</td>
                        <td className="px-4 py-3 font-bold text-text-main">{row.courseName}</td>
                        <td className="px-4 py-3 text-text-soft">{row.reportType}</td>
                        <td className="px-4 py-3 text-text-soft">{formatDate(row.startDate)}</td>
                        <td className="px-4 py-3 text-text-soft">{formatDate(row.endDate)}</td>
                        <td className="px-4 py-3 text-text-soft">{formatLocationType(row.locationType)}</td>
                        <td className="px-4 py-3 text-text-soft">{row.presenterName}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handlePrint(row.id)} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main transition hover:bg-background">طباعة التقرير</button>
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
    <div className="rounded-3xl border border-border bg-white p-5 shadow-card">
      <div className="text-sm font-bold text-text-soft">{title}</div>
      <div className="mt-2 text-4xl font-extrabold text-primary">{value}</div>
    </div>
  );
}
