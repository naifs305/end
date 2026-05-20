import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import toast from 'react-hot-toast';

function fmtDT(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function waitHours(submittedAt) {
  if (!submittedAt) return 0;
  return (Date.now() - new Date(submittedAt).getTime()) / 3600000;
}

function WaitBadge({ submittedAt }) {
  const h = waitHours(submittedAt);
  if (h < 6)  return <span className="rounded-full bg-forest-50 border border-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">{Math.round(h)}س</span>;
  if (h < 24) return <span className="rounded-full bg-sand/20 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">{Math.round(h)}س</span>;
  return <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">{Math.round(h/24)}ي {Math.round(h%24)}س</span>;
}

const ELEMENT_ICON = {
  opening_report:        '📋',
  closing_report:        '📝',
  advance_req:           '💰',
  settlement:            '🧾',
  supervisor_compensation: '👤',
  trainer_compensation:  '🎓',
  revenues:              '📊',
  materials:             '📦',
  certificates:          '🏆',
  pre_test:              '✏️',
  post_test:             '✅',
  trainee_registration:  '👥',
  registration_message:  '📨',
  reaction_evaluation:   '⭐',
};

export default function ApprovalsQueue() {
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [busyId, setBusyId]       = useState('');
  const [filters, setFilters]     = useState({ search: '', project: '', employee: '' });
  const [page, setPage]           = useState(1);
  const [decision, setDecision]   = useState({});  // { [id]: { mode: 'RETURNED'|'REJECTED', reason: '' } }
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/approvals-queue');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return [...items]
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
      .filter((item) => {
        const matchQ = !q || [item.courseName, item.elementName, item.projectName, item.employeeName]
          .some((v) => v?.toLowerCase().includes(q));
        const matchP = !filters.project  || item.projectName  === filters.project;
        const matchE = !filters.employee || item.employeeName === filters.employee;
        return matchQ && matchP && matchE;
      });
  }, [items, filters]);

  const projects  = useMemo(() => [...new Set(items.map((i) => i.projectName).filter(Boolean))], [items]);
  const employees = useMemo(() => [...new Set(items.map((i) => i.employeeName).filter(Boolean))], [items]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current   = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const urgent    = items.filter((i) => waitHours(i.submittedAt) > 24).length;

  useEffect(() => { setPage(1); }, [filters]);

  const openDecision = (id, mode) =>
    setDecision((prev) => prev[id]?.mode === mode ? {} : { [id]: { mode, reason: '' } });

  const confirmDecision = async (id) => {
    const d = decision[id];
    if (!d) return;
    if ((d.mode === 'RETURNED' || d.mode === 'REJECTED') && !d.reason.trim()) {
      toast.error('السبب مطلوب'); return;
    }
    setBusyId(id);
    try {
      await api.put(`/closure/${id}`, { status: d.mode, notes: d.reason });
      toast.success(d.mode === 'APPROVED' ? 'تم الاعتماد' : d.mode === 'RETURNED' ? 'أُعيد للموظف' : 'رُفض');
      setDecision({});
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر تنفيذ الإجراء');
    } finally { setBusyId(''); }
  };

  const approve = async (id) => {
    setBusyId(id);
    try {
      await api.put(`/closure/${id}`, { status: 'APPROVED' });
      toast.success('تم الاعتماد ✓');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'تعذر الاعتماد'); }
    finally { setBusyId(''); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس + إحصائيات سريعة */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div>
            <h1 className="text-xl font-extrabold text-primary">طابور الاعتمادات</h1>
            <p className="mt-0.5 text-xs text-text-soft">مرتب من الأقدم — جميع العناصر المرفوعة بانتظار قرارك</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-text-main">
              الإجمالي <span className="rounded-full bg-primary px-2 py-0.5 text-white">{filtered.length}</span>
            </span>
            {urgent > 0 && (
              <span className="flex items-center gap-1.5 rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-sm font-bold text-danger">
                ⚠️ متأخرة +24 ساعة <span className="rounded-full bg-danger px-2 py-0.5 text-white">{urgent}</span>
              </span>
            )}
            <button onClick={load} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main hover:bg-background">↻ تحديث</button>
          </div>
        </div>

        {/* فلاتر مدمجة */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <input value={filters.search}
            onChange={(e) => setFilters(p => ({...p, search: e.target.value}))}
            placeholder="🔍 بحث..."
            className="min-w-[160px] flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={filters.project} onChange={(e) => setFilters(p => ({...p, project: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل المشاريع</option>
            {projects.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filters.employee} onChange={(e) => setFilters(p => ({...p, employee: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الموظفين</option>
            {employees.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {(filters.search || filters.project || filters.employee) && (
            <button onClick={() => setFilters({ search:'', project:'', employee:'' })}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">✕</button>
          )}
        </div>

        {/* الجدول */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-text-soft">
              <div className="flex items-center gap-2"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /><span>جاري التحميل...</span></div>
            </div>
          ) : current.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-3xl">✅</div>
              <p className="mt-2 font-bold text-text-main">لا توجد عناصر بانتظار الاعتماد</p>
              <p className="text-sm text-text-soft">الصفحة محدّثة وجميع العناصر تمت معالجتها</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {current.map((item) => {
                const h = waitHours(item.submittedAt);
                const isUrgent = h > 24;
                const dec = decision[item.id];
                const icon = ELEMENT_ICON[item.elementKey] || '📄';

                return (
                  <div key={item.id}
                    className={`p-4 transition hover:bg-background ${isUrgent ? 'border-s-4 border-s-danger' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">

                      {/* معلومات العنصر */}
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="mt-0.5 text-xl">{icon}</span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-text-main">{item.elementName}</span>
                            <WaitBadge submittedAt={item.submittedAt} />
                            {isUrgent && <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">تأخر!</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-text-soft">
                            <span className="font-bold text-primary">{item.courseName}</span>
                            <span>•</span>
                            <span>{item.projectName || '-'}</span>
                            <span>•</span>
                            <span>{item.employeeName || '-'}</span>
                            <span>•</span>
                            <span>{fmtDT(item.submittedAt)}</span>
                          </div>
                          {item.delayReason && (
                            <div className="mt-1.5 rounded-xl border border-sand/40 bg-sand/10 px-2 py-1 text-xs text-warning">
                              <span className="font-bold">مبرر الموظف: </span>
                              <span className="text-text-main">{item.delayReason}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* أزرار الإجراء */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          onClick={() => approve(item.id)}
                          disabled={busyId === item.id}
                          className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition">
                          ✓ اعتماد
                        </button>
                        <button
                          onClick={() => openDecision(item.id, 'RETURNED')}
                          disabled={busyId === item.id}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${dec?.mode === 'RETURNED' ? 'bg-warning text-white' : 'border border-sand/40 bg-sand/10 text-warning hover:bg-sand/20'}`}>
                          ↩ إعادة
                        </button>
                        <button
                          onClick={() => openDecision(item.id, 'REJECTED')}
                          disabled={busyId === item.id}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${dec?.mode === 'REJECTED' ? 'bg-danger text-white' : 'border border-burgundy/20 bg-burgundy/5 text-danger hover:bg-burgundy/10'}`}>
                          ✕ رفض
                        </button>
                      </div>
                    </div>

                    {/* نموذج السبب */}
                    {dec && (
                      <div className={`mt-3 rounded-xl border p-3 ${dec.mode === 'RETURNED' ? 'border-sand/40 bg-sand/10' : 'border-burgundy/20 bg-burgundy/5'}`}>
                        <label className={`mb-1.5 block text-xs font-bold ${dec.mode === 'RETURNED' ? 'text-warning' : 'text-danger'}`}>
                          {dec.mode === 'RETURNED' ? 'سبب الإعادة (مطلوب)' : 'سبب الرفض (مطلوب)'}
                        </label>
                        <textarea
                          value={dec.reason}
                          onChange={(e) => setDecision(prev => ({ ...prev, [item.id]: { ...prev[item.id], reason: e.target.value } }))}
                          rows={2}
                          maxLength={400}
                          placeholder="وضّح للموظف..."
                          className="w-full resize-none rounded-lg border border-white/50 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-current"
                          autoFocus
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => confirmDecision(item.id)}
                            disabled={busyId === item.id}
                            className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${dec.mode === 'RETURNED' ? 'bg-warning' : 'bg-danger'}`}>
                            {busyId === item.id ? '...' : 'تأكيد'}
                          </button>
                          <button onClick={() => setDecision({})}
                            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-soft">
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ترقيم الصفحات */}
          {!loading && filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-xs text-text-soft">{filtered.length} عنصر — صفحة {page} من {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">السابق</button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">التالي</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
