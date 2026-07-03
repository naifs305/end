// صفحة التقارير الميدانية — إعادة بناء احترافية
import { canViewReports, isAdminRole } from '../lib/roles';
import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../context/AuthContext';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── ثوابت ──────────────────────────────────────────────────────────────────
const REPORT_META = {
  opening_report: { label: 'تقرير الافتتاح', short: 'افتتاح', color: '#253C32', bg: 'bg-primary-light', border: 'border-primary/20', text: 'text-primary',   dot: 'bg-primary',  icon: '📋' },
  closing_report: { label: 'تقرير الاختتام', short: 'اختتام', color: '#5D8A70', bg: 'bg-forest-50',     border: 'border-accent/20',   text: 'text-accent',    dot: 'bg-accent',   icon: '📝' },
  report:         { label: 'تقرير',           short: 'تقرير',  color: '#4B5952', bg: 'bg-background',    border: 'border-border',      text: 'text-text-soft', dot: 'bg-text-soft',icon: '📄' },
  notes_report:   { label: 'تقرير ملاحظات',   short: 'ملاحظات', color: '#8B7D6B', bg: 'bg-sand/10',       border: 'border-sand/30',     text: 'text-warning',   dot: 'bg-sand',     icon: '🗒️' },
};

const STATUS_META = {
  APPROVED:         { label: 'معتمد',             cls: 'bg-forest-50 text-accent border-accent/20',      icon: '✓' },
  PENDING_APPROVAL: { label: 'بانتظار الاعتماد',  cls: 'bg-sand/20 text-warning border-sand/40',         icon: '⏳' },
  ARCHIVED:         { label: 'مؤرشف',             cls: 'bg-border text-text-soft border-border',        icon: '🗄️' },
};

function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// ── مكوّن بطاقة تقرير واحد ─────────────────────────────────────────────────
function ReportCard({ row, onPrint, onEml, printing, downloading }) {
  const rm  = REPORT_META[row.reportKey] || REPORT_META.report;
  const sm  = STATUS_META[row.status];
  const busy = printing === row.id || downloading === row.id;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-soft hover:-translate-y-0.5
      ${row.status === 'APPROVED' ? 'border-border' : 'border-sand/30'}`}
      style={{ borderTop: `3px solid ${rm.color}` }}>

      {/* رأس البطاقة */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{rm.icon}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rm.bg} ${rm.border} ${rm.text}`}>
              {rm.short}
            </span>
          </div>
          {sm && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold shrink-0 ${sm.cls}`}>
              {sm.icon} {sm.label}
            </span>
          )}
        </div>

        {/* اسم الدورة */}
        <Link href={`/courses/${row.courseId}`}
          className="block font-extrabold text-sm text-text-main hover:text-primary transition leading-snug line-clamp-2 mb-2">
          {row.courseName}
        </Link>

        {/* تفاصيل */}
        <div className="space-y-1 text-[11px] text-text-soft">
          <div className="flex items-center gap-1.5">
            <span>👤</span>
            <span className="font-medium text-text-main">{row.presenterName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>📅</span>
            <span>{fmtDate(row.startDate)} — {fmtDate(row.endDate)}</span>
          </div>
          {row.executionAt && (
            <div className="flex items-center gap-1.5">
              <span>📤</span>
              <span>رُفع: {fmtDateTime(row.executionAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* أزرار الإجراء */}
      <div className="flex gap-2 border-t border-border bg-background px-4 py-2.5">
        <button
          onClick={() => onPrint(row.id, row.reportKey)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main hover:border-primary hover:text-primary disabled:opacity-50 transition"
        >
          {printing === row.id
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            : '🖨️'}
          طباعة
        </button>
        <button
          onClick={() => onEml(row.id, row.reportKey)}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-dark disabled:opacity-50 transition"
        >
          {downloading === row.id
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : '📧'}
          EML
        </button>
      </div>
    </div>
  );
}

// ── الصفحة الرئيسية ────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { activeRole } = useAuth();
  const isAdmin = isAdminRole(activeRole) || activeRole === 'PROJECT_SUPERVISOR';

  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [printing,   setPrinting]   = useState(null);
  const [downloading,setDownloading]= useState(null);
  const [filters,    setFilters]    = useState({ search: '', type: '', status: '', presenter: '' });
  const [view,       setView]       = useState('cards'); // 'cards' | 'list'
  const [groupBy,    setGroupBy]    = useState('none');  // 'none' | 'course' | 'type'

  useEffect(() => {
    if (!canViewReports(activeRole)) return;
    setLoading(true);
    api.get('/reports')
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [activeRole]);

  const presenters = useMemo(() => [...new Set(rows.map(r => r.presenterName).filter(Boolean))], [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    const q = filters.search.trim().toLowerCase();
    return (!q || r.courseName?.toLowerCase().includes(q) || r.presenterName?.toLowerCase().includes(q))
      && (!filters.type    || r.reportKey === filters.type)
      && (!filters.status  || r.status === filters.status)
      && (!filters.presenter || r.presenterName === filters.presenter);
  }), [rows, filters]);

  const stats = useMemo(() => ({
    total:    rows.length,
    approved: rows.filter(r => r.status === 'APPROVED').length,
    pending:  rows.filter(r => r.status === 'PENDING_APPROVAL').length,
    opening:  rows.filter(r => r.reportKey === 'opening_report').length,
    closing:  rows.filter(r => r.reportKey === 'closing_report').length,
    notes:    rows.filter(r => r.reportKey === 'notes_report').length,
  }), [rows]);

  // تجميع حسب الدورة
  const grouped = useMemo(() => {
    if (groupBy !== 'course') return null;
    const map = new Map();
    for (const r of filtered) {
      const key = r.courseId;
      if (!map.has(key)) map.set(key, { courseId: r.courseId, courseName: r.courseName, startDate: r.startDate, endDate: r.endDate, reports: [] });
      map.get(key).reports.push(r);
    }
    return [...map.values()].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  }, [filtered, groupBy]);

  // ── إجراءات ──────────────────────────────────────────────────────────────
  const exportBase = (id, key) => key === 'notes_report' ? `/field-reports/${id}` : `/closure/${id}`;

  const handlePrint = async (id, key) => {
    setPrinting(id);
    try {
      const res = await api.get(`${exportBase(id, key)}/export`, { responseType: 'text', headers: { Accept: 'text/html' } });
      const w = window.open('', '_blank');
      if (!w) return toast.error('تعذر فتح نافذة الطباعة — اسمح بالنوافذ المنبثقة');
      w.document.open(); w.document.write(res.data); w.document.close();
    } catch { toast.error('تعذر فتح التقرير'); }
    finally { setPrinting(null); }
  };

  const handleEml = async (id, key) => {
    setDownloading(id);
    try {
      const res = await api.get(`${exportBase(id, key)}/export-eml`, { responseType: 'blob', headers: { Accept: 'message/rfc822' } });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const m = (res.headers['content-disposition'] || '').match(/filename="?([^";]+)"?/i);
      a.href = url;
      a.download = m?.[1] || (key === 'opening_report' ? 'opening-report.eml' : key === 'closing_report' ? 'closing-report.eml' : 'notes-report.eml');
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('تم تنزيل الملف ✓');
    } catch { toast.error('تعذر تنزيل ملف EML'); }
    finally { setDownloading(null); }
  };

  if (!canViewReports(activeRole)) {
    return (
      <MainLayout>
        <div className="rounded-2xl border border-danger/20 bg-white p-8 text-center shadow-card">
          <p className="text-danger font-bold">غير مصرح لك بالوصول إلى التقارير</p>
        </div>
      </MainLayout>
    );
  }

  const hasActiveFilter = Object.values(filters).some(Boolean);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* ── رأس الصفحة ─────────────────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-extrabold text-primary">📑 التقارير الميدانية</h1>
                <p className="mt-0.5 text-xs text-text-soft">تقارير افتتاح واختتام الدورات — طباعة وتنزيل EML</p>
              </div>
              {/* عرض / تجميع */}
              <div className="flex items-center gap-2">
                <select
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium outline-none focus:border-primary">
                  <option value="none">بدون تجميع</option>
                  <option value="course">تجميع بالدورة</option>
                </select>
                <div className="flex rounded-xl border border-border overflow-hidden">
                  <button onClick={() => setView('cards')}
                    className={`px-3 py-2 text-xs font-bold transition ${view === 'cards' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>
                    ⊞
                  </button>
                  <button onClick={() => setView('list')}
                    className={`px-3 py-2 text-xs font-bold transition ${view === 'list' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>
                    ≡
                  </button>
                </div>
              </div>
            </div>

            {/* إحصائيات */}
            {!loading && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => setFilters(p => ({...p, type:'', status:''}))}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-text-main hover:border-primary transition">
                  <span className="text-primary font-extrabold">{stats.total}</span>
                  <span className="text-text-soft">إجمالي</span>
                </button>
                <button onClick={() => setFilters(p => ({...p, status: p.status === 'APPROVED' ? '' : 'APPROVED'}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition
                    ${filters.status === 'APPROVED' ? 'border-accent/40 bg-forest-50 text-accent' : 'border-accent/20 bg-forest-50/60 text-accent hover:border-accent/40'}`}>
                  <span className="font-extrabold">{stats.approved}</span>
                  <span>معتمدة ✓</span>
                </button>
                <button onClick={() => setFilters(p => ({...p, status: p.status === 'PENDING_APPROVAL' ? '' : 'PENDING_APPROVAL'}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition
                    ${filters.status === 'PENDING_APPROVAL' ? 'border-sand/60 bg-sand/20 text-warning' : 'border-sand/30 bg-sand/10 text-warning hover:border-sand/50'}`}>
                  <span className="font-extrabold">{stats.pending}</span>
                  <span>انتظار ⏳</span>
                </button>
                <button onClick={() => setFilters(p => ({...p, type: p.type === 'opening_report' ? '' : 'opening_report'}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition
                    ${filters.type === 'opening_report' ? 'border-primary/40 bg-primary-light text-primary' : 'border-primary/20 bg-primary-light/60 text-primary hover:border-primary/30'}`}>
                  <span>📋</span>
                  <span>{stats.opening} افتتاح</span>
                </button>
                <button onClick={() => setFilters(p => ({...p, type: p.type === 'closing_report' ? '' : 'closing_report'}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition
                    ${filters.type === 'closing_report' ? 'border-accent/40 bg-forest-50 text-accent' : 'border-accent/20 bg-forest-50/60 text-accent hover:border-accent/30'}`}>
                  <span>📝</span>
                  <span>{stats.closing} اختتام</span>
                </button>
                <button onClick={() => setFilters(p => ({...p, type: p.type === 'notes_report' ? '' : 'notes_report'}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition
                    ${filters.type === 'notes_report' ? 'border-sand/60 bg-sand/20 text-warning' : 'border-sand/30 bg-sand/10 text-warning hover:border-sand/50'}`}>
                  <span>🗒️</span>
                  <span>{stats.notes} ملاحظات</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── شريط الفلتر ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <input
            value={filters.search}
            onChange={e => setFilters(p => ({...p, search: e.target.value}))}
            placeholder="🔍 ابحث باسم الدورة أو المقدم..."
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          {isAdmin && (
            <select
              value={filters.presenter}
              onChange={e => setFilters(p => ({...p, presenter: e.target.value}))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">كل المقدمين</option>
              {presenters.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          {hasActiveFilter && (
            <button
              onClick={() => setFilters({ search: '', type: '', status: '', presenter: '' })}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-soft hover:bg-background transition">
              ✕ مسح
            </button>
          )}
          {!loading && (
            <span className="flex items-center rounded-xl border border-border bg-background px-3 py-2 text-xs text-text-soft">
              يُعرض <strong className="mx-1 text-primary">{filtered.length}</strong> من {rows.length}
            </span>
          )}
        </div>

        {/* ── المحتوى ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-text-soft">جاري تحميل التقارير...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
            <p className="text-4xl mb-3">📑</p>
            <p className="font-bold text-text-main">لا توجد تقارير</p>
            <p className="mt-1 text-sm text-text-soft">
              {hasActiveFilter ? 'جرّب تغيير الفلتر' : 'لم يُرفع أي تقرير بعد'}
            </p>
          </div>
        ) : groupBy === 'course' && grouped ? (

          /* ── عرض مجمَّع بالدورة ── */
          <div className="space-y-3">
            {grouped.map(group => (
              <CourseGroup
                key={group.courseId}
                group={group}
                onPrint={handlePrint}
                onEml={handleEml}
                printing={printing}
                downloading={downloading}
                view={view}
              />
            ))}
          </div>

        ) : view === 'cards' ? (

          /* ── عرض بطاقات ── */
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map(row => (
              <ReportCard
                key={row.id}
                row={row}
                onPrint={handlePrint}
                onEml={handleEml}
                printing={printing}
                downloading={downloading}
              />
            ))}
          </div>

        ) : (

          /* ── عرض قائمة ── */
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-0 border-b border-border bg-background px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-text-soft/60">
              <span className="w-20">النوع</span>
              <span>الدورة</span>
              <span className="w-32 text-center">المقدم</span>
              <span className="w-28 text-center">الحالة</span>
              <span className="w-24 text-center">إجراء</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(row => {
                const rm = REPORT_META[row.reportKey] || REPORT_META.report;
                const sm = STATUS_META[row.status];
                return (
                  <div key={row.id}
                    className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-0 px-4 py-3 hover:bg-background transition">
                    <div className="w-20">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${rm.bg} ${rm.border} ${rm.text}`}>
                        {rm.icon} {rm.short}
                      </span>
                    </div>
                    <div className="min-w-0 pr-2">
                      <Link href={`/courses/${row.courseId}`}
                        className="block truncate font-bold text-sm text-text-main hover:text-primary transition">
                        {row.courseName}
                      </Link>
                      <span className="text-[11px] text-text-soft">
                        {fmtDate(row.startDate)} — {fmtDate(row.endDate)}
                      </span>
                    </div>
                    <div className="w-32 text-center text-xs text-text-soft px-2 truncate">{row.presenterName}</div>
                    <div className="w-28 text-center px-2">
                      {sm && (
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sm.cls}`}>
                          {sm.icon} {sm.label}
                        </span>
                      )}
                    </div>
                    <div className="w-24 flex justify-center gap-1.5">
                      <button onClick={() => handlePrint(row.id, row.reportKey)} disabled={printing === row.id || downloading === row.id}
                        className="rounded-lg border border-border bg-white p-1.5 text-text-soft hover:border-primary hover:text-primary disabled:opacity-40 transition"
                        title="طباعة">
                        {printing === row.id
                          ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          : <span className="text-sm">🖨️</span>}
                      </button>
                      <button onClick={() => handleEml(row.id, row.reportKey)} disabled={printing === row.id || downloading === row.id}
                        className="rounded-lg bg-primary p-1.5 text-white hover:bg-primary-dark disabled:opacity-40 transition"
                        title="تنزيل EML">
                        {downloading === row.id
                          ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          : <span className="text-sm">📧</span>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

// ── مجموعة دورة واحدة (عرض مجمَّع) ──────────────────────────────────────────
function CourseGroup({ group, onPrint, onEml, printing, downloading, view }) {
  const [open, setOpen] = useState(true);
  const approved = group.reports.filter(r => r.status === 'APPROVED').length;
  const hasOpening = group.reports.some(r => r.reportKey === 'opening_report');
  const hasClosing = group.reports.some(r => r.reportKey === 'closing_report' || r.reportKey === 'report');

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
      {/* رأس المجموعة */}
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-background transition">
        <div className="flex items-center gap-3 min-w-0">
          {/* أيقونة اكتمال الدورة */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white
            ${approved === group.reports.length ? 'bg-accent' : 'bg-primary'}`}>
            {approved === group.reports.length ? '✓' : group.reports.length}
          </div>
          <div className="min-w-0 text-right">
            <Link href={`/courses/${group.courseId}`}
              onClick={e => e.stopPropagation()}
              className="block truncate font-extrabold text-text-main hover:text-primary transition">
              {group.courseName}
            </Link>
            <p className="text-[11px] text-text-soft mt-0.5">
              {[
                fmtDate(group.startDate) + ' — ' + fmtDate(group.endDate),
                hasOpening && 'افتتاح',
                hasClosing && 'اختتام',
              ].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold
            ${approved === group.reports.length
              ? 'bg-forest-50 text-accent border-accent/20'
              : 'bg-sand/20 text-warning border-sand/40'}`}>
            {approved}/{group.reports.length} معتمد
          </span>
          <span className="text-xs text-text-soft">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* تقارير المجموعة */}
      {open && (
        <div className={`border-t border-border p-4 ${
          view === 'cards'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2'
            : 'space-y-2'
        }`}>
          {group.reports.map(row => {
            const rm = REPORT_META[row.reportKey] || REPORT_META.report;
            const sm = STATUS_META[row.status];
            const busy = printing === row.id || downloading === row.id;

            if (view === 'cards') {
              return (
                <div key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5 hover:border-primary/30 transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-base shrink-0 ${busy ? 'opacity-50' : ''}`}>{rm.icon}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rm.bg} ${rm.border} ${rm.text}`}>{rm.short}</span>
                        {sm && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sm.cls}`}>{sm.icon} {sm.label}</span>}
                      </div>
                      <p className="text-[11px] text-text-soft mt-0.5">{row.presenterName} · {fmtDate(row.executionAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onPrint(row.id, row.reportKey)} disabled={busy}
                      className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-soft hover:border-primary hover:text-primary disabled:opacity-40 transition">
                      {printing === row.id ? '...' : '🖨️'}
                    </button>
                    <button onClick={() => onEml(row.id, row.reportKey)} disabled={busy}
                      className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-primary-dark disabled:opacity-40 transition">
                      {downloading === row.id ? '...' : '📧'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                <span className="text-sm">{rm.icon}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${rm.bg} ${rm.border} ${rm.text}`}>{rm.short}</span>
                <span className="flex-1 text-xs text-text-soft">{row.presenterName}</span>
                {sm && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${sm.cls}`}>{sm.label}</span>}
                <div className="flex gap-1.5">
                  <button onClick={() => onPrint(row.id, row.reportKey)} disabled={busy}
                    className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold hover:border-primary hover:text-primary disabled:opacity-40 transition">
                    🖨️
                  </button>
                  <button onClick={() => onEml(row.id, row.reportKey)} disabled={busy}
                    className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-primary-dark disabled:opacity-40 transition">
                    📧
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
