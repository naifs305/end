import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

const PAGE_SIZE = 10;

function formatDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return '-';
  }
}

export default function ApprovalsQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: '', project: '', employee: '' });

  const loadQueue = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/analytics/approvals-queue');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setItems([]);
      setError(err?.response?.data?.message || 'تعذر تحميل طابور الاعتمادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !q || [item.courseName, item.elementName, item.projectName, item.employeeName, item.ownerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      const matchesProject = !filters.project || item.projectName === filters.project;
      const matchesEmployee = !filters.employee || item.employeeName === filters.employee;
      return matchesSearch && matchesProject && matchesEmployee;
    });
  }, [items, filters]);

  const projects = useMemo(() => [...new Set(items.map((item) => item.projectName).filter(Boolean))], [items]);
  const employees = useMemo(() => [...new Set(items.map((item) => item.employeeName).filter(Boolean))], [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.project, filters.employee]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const decideItem = async (itemId, decision) => {
    let notes = '';
    if (decision === 'RETURNED') {
      notes = window.prompt('اكتب سبب إعادة العنصر للموظف', '') || '';
      if (!notes.trim()) return;
    }
    if (decision === 'REJECTED') {
      notes = window.prompt('اكتب سبب رفض العنصر', '') || '';
      if (!notes.trim()) return;
    }

    try {
      setBusyId(itemId);
      setError('');
      await api.put(`/closure/${itemId}`, { status: decision, notes });
      await loadQueue();
    } catch (err) {
      setError(err?.response?.data?.message || 'تعذر تنفيذ الإجراء على العنصر');
    } finally {
      setBusyId('');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-primary">طابور الاعتمادات</h1>
              <p className="mt-2 text-sm text-text-soft">يعرض جميع العناصر التي تحتاج اعتمادًا مباشرًا من الأقدم إلى الأحدث</p>
            </div>
            <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-text-main">
              إجمالي العناصر: {filteredItems.length}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-white p-4 md:p-6 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-primary">الفلاتر</h2>
            <button
              type="button"
              onClick={() => setFilters({ search: '', project: '', employee: '' })}
              className="rounded-2xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:bg-background"
            >
              إعادة تعيين
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="بحث باسم الدورة أو العنصر أو الموظف"
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
            <select
              value={filters.project}
              onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">كل المشاريع</option>
              {projects.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select
              value={filters.employee}
              onChange={(e) => setFilters((prev) => ({ ...prev, employee: e.target.value }))}
              className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            >
              <option value="">كل الموظفين</option>
              {employees.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-danger/20 bg-white p-4 text-sm font-bold text-danger shadow-card">
            {error}
          </div>
        ) : null}

        <section className="rounded-3xl border border-border bg-white shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-background">
                <tr className="text-right text-text-soft">
                  <th className="px-4 py-3 font-bold">الدورة</th>
                  <th className="px-4 py-3 font-bold">العنصر</th>
                  <th className="px-4 py-3 font-bold">المشروع</th>
                  <th className="px-4 py-3 font-bold">الموظف</th>
                  <th className="px-4 py-3 font-bold">المعتمد</th>
                  <th className="px-4 py-3 font-bold">تاريخ ووقت التقديم</th>
                  <th className="px-4 py-3 font-bold">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-text-soft">جاري تحميل الاعتمادات...</td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-12 text-center text-text-soft">لا توجد عناصر بانتظار الاعتماد حاليًا</td>
                  </tr>
                ) : currentItems.map((item) => (
                  <tr key={item.id} className="border-t border-border hover:bg-background transition">
                    <td className="px-4 py-3 font-bold text-text-main">{item.courseName}</td>
                    <td className="px-4 py-3 text-text-soft">{item.elementName}</td>
                    <td className="px-4 py-3 text-text-soft">{item.projectName || '-'}</td>
                    <td className="px-4 py-3 text-text-soft">{item.employeeName || '-'}</td>
                    <td className="px-4 py-3 text-text-soft">{item.approverName || '-'}</td>
                    <td className="px-4 py-3 text-text-soft">{formatDateTime(item.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => decideItem(item.id, 'APPROVED')}
                          className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
                        >
                          اعتماد
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => decideItem(item.id, 'RETURNED')}
                          className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main transition hover:bg-background disabled:opacity-50"
                        >
                          إعادة للموظف
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => decideItem(item.id, 'REJECTED')}
                          className="rounded-xl border border-danger/20 bg-white px-3 py-2 text-xs font-bold text-danger transition hover:bg-red-50 disabled:opacity-50"
                        >
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && filteredItems.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-text-soft">
                عرض {Math.min((page - 1) * PAGE_SIZE + 1, filteredItems.length)} إلى {Math.min(page * PAGE_SIZE, filteredItems.length)} من {filteredItems.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:bg-background disabled:opacity-50"
                >
                  السابق
                </button>
                <div className="rounded-xl bg-background px-4 py-2 text-sm font-bold text-text-main">
                  {page} / {totalPages}
                </div>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main transition hover:bg-background disabled:opacity-50"
                >
                  التالي
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </MainLayout>
  );
}
