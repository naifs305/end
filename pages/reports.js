import { canViewReports, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const REPORT_TYPE = {
  opening_report: { label: 'افتتاح',   cls: 'bg-primary-light text-primary border-primary/20',   icon: '📋' },
  closing_report: { label: 'اختتام',   cls: 'bg-forest-50 text-accent border-accent/20',         icon: '📝' },
  report:         { label: 'تقرير',    cls: 'bg-background text-text-soft border-border',         icon: '📄' },
};

const STATUS_CLS = {
  APPROVED:         'bg-forest-50 text-accent border-accent/20',
  PENDING_APPROVAL: 'bg-sand/20 text-warning border-sand/40',
};
const STATUS_LABEL = { APPROVED: 'معتمد', PENDING_APPROVAL: 'بانتظار الاعتماد' };

function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ReportsPage() {
  const { activeRole } = useAuth();
  const isAdmin = isAdminRole(activeRole);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ search: '', type: '', status: '', presenter: '' });

  useEffect(() => {
    if (!canViewReports(activeRole)) return;
    setLoading(true);
    api.get('/reports')
      .then((res) => setRows(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [activeRole]);

  const presenters = useMemo(() => [...new Set(rows.map((r) => r.presenterName).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const q = filters.search.trim().toLowerCase();
    return (!q || r.courseName?.toLowerCase().includes(q))
      && (!filters.type    || r.reportKey === filters.type || r.reportType?.includes(filters.type))
      && (!filters.status  || r.status === filters.status)
      && (!filters.presenter || r.presenterName === filters.presenter);
  }), [rows, filters]);

  const stats = useMemo(() => ({
    total:    filtered.length,
    approved: filtered.filter((r) => r.status === 'APPROVED').length,
    pending:  filtered.filter((r) => r.status === 'PENDING_APPROVAL').length,
  }), [filtered]);

  const handlePrint = async (id) => {
    try {
      const res = await api.get(`/closure/${id}/export`, { responseType: 'text', headers: { Accept: 'text/html' } });
      const w = window.open('', '_blank');
      if (!w) return toast.error('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch { toast.error('تعذر فتح التقرير'); }
  };

  const handleEml = async (id, key) => {
    try {
      const res = await api.get(`/closure/${id}/export-eml`, { responseType: 'blob', headers: { Accept: 'message/rfc822' } });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const disp = res.headers['content-disposition'] || '';
      const m = disp.match(/filename="?([^";]+)"?/i);
      a.href = url; a.download = m?.[1] || (key === 'opening_report' ? 'opening-report.eml' : 'closing-report.eml');
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('تم تنزيل الملف');
    } catch { toast.error('تعذر تنزيل ملف EML'); }
  };

  if (!canViewReports(activeRole)) {
    return <MainLayout><div className="rounded-2xl border border-danger/20 bg-white p-6 text-sm text-danger">غير مصرح لك بالوصول.</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس + بطاقات سريعة */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-primary">التقارير الميدانية</h1>
              <p className="mt-0.5 text-xs text-text-soft">تقارير الافتتاح والاختتام — طباعة وتنزيل EML</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-xl border border-border bg-background px-4 py-2 text-center">
                <div className="text-lg font-extrabold text-primary">{stats.total}</div>
                <div className="text-[10px] text-text-soft">إجمالي</div>
              </div>
              <div className="rounded-xl border border-accent/20 bg-forest-50 px-4 py-2 text-center">
                <div className="text-lg font-extrabold text-accent">{stats.approved}</div>
                <div className="text-[10px] text-text-soft">معتمدة</div>
              </div>
              <div className="rounded-xl border border-sand/40 bg-sand/10 px-4 py-2 text-center">
                <div className="text-lg font-extrabold text-warning">{stats.pending}</div>
                <div className="text-[10px] text-text-soft">انتظار</div>
              </div>
            </div>
          </div>
        </div>

        {/* فلاتر */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <input value={filters.search}
            onChange={(e) => setFilters(p => ({...p, search: e.target.value}))}
            placeholder="🔍 اسم الدورة..."
            className="min-w-[160px] flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={filters.type} onChange={(e) => setFilters(p => ({...p, type: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الأنواع</option>
            <option value="opening_report">افتتاح</option>
            <option value="closing_report">اختتام</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters(p => ({...p, status: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الحالات</option>
            <option value="APPROVED">معتمدة</option>
            <option value="PENDING_APPROVAL">بانتظار الاعتماد</option>
          </select>
          {isAdmin && (
            <select value={filters.presenter} onChange={(e) => setFilters(p => ({...p, presenter: e.target.value}))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">كل المقدمين</option>
              {presenters.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ search:'', type:'', status:'', presenter:'' })}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">✕</button>
          )}
        </div>

        {/* القائمة */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">جاري التحميل...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-soft">لا توجد تقارير</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((row, i) => {
                const rt  = REPORT_TYPE[row.reportKey] || REPORT_TYPE.report;
                const sc  = STATUS_CLS[row.status]    || 'bg-background text-text-soft border-border';
                const sl  = STATUS_LABEL[row.status]  || row.status;
                return (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-background transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xl">{rt.icon}</span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${rt.cls}`}>{rt.label}</span>
                          <span className="font-bold text-sm text-text-main">{row.courseName}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sc}`}>{sl}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-text-soft">
                          <span>{row.presenterName}</span>
                          <span>•</span>
                          <span>{fmtDate(row.startDate)} — {fmtDate(row.endDate)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => handlePrint(row.id)}
                        className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-bold text-text-main hover:bg-background">
                        🖨️ طباعة
                      </button>
                      <button onClick={() => handleEml(row.id, row.reportKey)}
                        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
                        📧 EML
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
