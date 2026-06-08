import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── أدوات ──────────────────────────────────────────────────────
function fmtDT(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ar-SA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function waitLabel(h) {
  if (h < 1)  return 'أقل من ساعة';
  if (h < 24) return `${h} ساعة`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r > 0 ? `${d} يوم و${r} ساعة` : `${d} يوم`;
}

const ELEMENT_ICON = {
  opening_report: '📋', closing_report: '📝', advance_req: '💰',
  settlement: '🧾', supervisor_compensation: '👤', trainer_compensation: '🎓',
  revenues: '📊', materials: '📦', certificates: '🏆',
  pre_test: '✏️', post_test: '✅', trainee_registration: '👥',
  registration_message: '📨', reaction_evaluation: '⭐', medical_insurance: '🏥',
};

// ── شارة وقت الانتظار ──────────────────────────────────────────
function WaitBadge({ hours }) {
  if (hours < 6)  return <span className="rounded-full bg-forest-50 border border-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">{waitLabel(hours)}</span>;
  if (hours < 24) return <span className="rounded-full bg-sand/20 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">{waitLabel(hours)}</span>;
  if (hours < 48) return <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-600">⚠️ {waitLabel(hours)}</span>;
  return <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">🚨 {waitLabel(hours)}</span>;
}

// ── صف عنصر داخل بطاقة الموظف ─────────────────────────────────
function ElementRow({ item, onDecide, busyId }) {
  const [showDecision, setShowDecision] = useState(null); // 'RETURNED' | 'REJECTED'
  const [reason, setReason] = useState('');
  const busy = busyId === item.id;
  const icon = ELEMENT_ICON[item.elementKey] || '📄';

  const confirm = async (status) => {
    if ((status === 'RETURNED' || status === 'REJECTED') && !reason.trim()) {
      toast.error('السبب مطلوب'); return;
    }
    await onDecide(item.id, status, reason);
    setShowDecision(null);
    setReason('');
  };

  return (
    <div className={`rounded-xl border bg-white p-3 space-y-2 transition
      ${item.isCritical ? 'border-danger/30' : item.isUrgent ? 'border-warning/30' : 'border-border'}`}>

      {/* ─ رأس العنصر ─ */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg mt-0.5">{icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-text-main">{item.elementName}</p>
            <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-text-soft">
              <Link href={`/courses/${item.courseId}`} className="text-primary font-bold hover:underline">
                {item.courseName}
              </Link>
              {item.courseCode && <span className="opacity-60">{item.courseCode}</span>}
            </div>
          </div>
        </div>
        <WaitBadge hours={item.waitHours} />
      </div>

      {/* ─ مسار العنصر ─ */}
      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
        {/* الخطوة ١: تقديم الموظف */}
        <div className="flex items-center gap-1 rounded-lg bg-primary-light border border-primary/20 px-2 py-1">
          <span className="text-primary font-bold">✓ قُدِّم</span>
          <span className="text-text-soft">{fmtDT(item.submittedAt)}</span>
        </div>
        <span className="text-text-soft">→</span>
        {/* الخطوة ٢: إعادة سابقة؟ */}
        {item.wasReturned && item.lastDecidedBy && (
          <>
            <div className="flex items-center gap-1 rounded-lg bg-sand/20 border border-sand/40 px-2 py-1">
              <span className="text-warning font-bold">↩ أُعيد</span>
              <span className="text-text-soft">من {item.lastDecidedBy}</span>
            </div>
            <span className="text-text-soft">→</span>
            <div className="flex items-center gap-1 rounded-lg bg-primary-light border border-primary/20 px-2 py-1">
              <span className="text-primary font-bold">✓ أُعيد تقديمه</span>
            </div>
            <span className="text-text-soft">→</span>
          </>
        )}
        {/* الخطوة ٣: بانتظار القرار */}
        <div className="flex items-center gap-1 rounded-lg bg-sand/10 border border-sand/30 px-2 py-1">
          <span className="text-warning font-bold animate-pulse">⏳ بانتظار قرارك</span>
        </div>
      </div>

      {/* ─ ملاحظات الإعادة ─ */}
      {item.wasReturned && item.notes && (
        <div className="rounded-lg border border-sand/40 bg-sand/10 px-3 py-1.5 text-xs text-warning">
          <span className="font-bold">سبب الإعادة السابقة: </span>{item.notes}
        </div>
      )}

      {/* ─ مبرر التأخر ─ */}
      {item.delayReason && (
        <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-soft">
          <span className="font-bold text-text-main">مبرر الموظف: </span>{item.delayReason}
        </div>
      )}

      {/* ─ أزرار القرار ─ */}
      {!showDecision ? (
        <div className="flex gap-2 pt-1">
          <button onClick={() => onDecide(item.id, 'APPROVED', '')} disabled={busy}
            className="rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? '...' : '✓ اعتماد'}
          </button>
          <button onClick={() => { setShowDecision('RETURNED'); setReason(''); }} disabled={busy}
            className="rounded-xl bg-warning px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            ↩ إعادة
          </button>
          <button onClick={() => { setShowDecision('REJECTED'); setReason(''); }} disabled={busy}
            className="rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            ✕ رفض
          </button>
        </div>
      ) : (
        <div className={`rounded-xl border p-3 space-y-2 ${showDecision === 'RETURNED' ? 'border-sand/40 bg-sand/10' : 'border-burgundy/20 bg-burgundy/5'}`}>
          <p className={`text-xs font-bold ${showDecision === 'RETURNED' ? 'text-warning' : 'text-danger'}`}>
            {showDecision === 'RETURNED' ? 'سبب الإعادة (مطلوب)' : 'سبب الرفض (مطلوب)'}
          </p>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            rows={2} maxLength={400} placeholder="وضّح للموظف..."
            className="w-full resize-none rounded-lg border border-white/60 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-current" />
          <div className="flex gap-2">
            <button onClick={() => confirm(showDecision)} disabled={busy}
              className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${showDecision === 'RETURNED' ? 'bg-warning' : 'bg-danger'}`}>
              {busy ? '...' : 'تأكيد'}
            </button>
            <button onClick={() => setShowDecision(null)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-soft">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── بطاقة الموظف (قابلة للطي) ─────────────────────────────────
function EmployeeCard({ group, onDecide, busyId }) {
  const [open, setOpen] = useState(group.criticalCount > 0 || group.urgentCount > 0);
  const hasCritical = group.criticalCount > 0;
  const hasUrgent   = group.urgentCount > 0;

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-card transition
      ${hasCritical ? 'border-danger/30' : hasUrgent ? 'border-warning/30' : 'border-border'}`}>

      {/* ─ رأس بطاقة الموظف ─ */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-start transition hover:bg-background
          ${hasCritical ? 'bg-burgundy/5' : hasUrgent ? 'bg-sand/10' : 'bg-white'}`}
      >
        <div className="flex items-center gap-3">
          {/* أفاتار */}
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white
            ${hasCritical ? 'bg-danger' : hasUrgent ? 'bg-warning' : 'bg-primary'}`}>
            {group.employeeName.charAt(0)}
          </div>
          <div>
            <p className="font-extrabold text-text-main">{group.employeeName}</p>
            <p className="text-xs text-text-soft">{group.projectName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* عدادات */}
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">
            {group.items.length} عنصر
          </span>
          {hasCritical && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">
              🚨 {group.criticalCount} حرج
            </span>
          )}
          {hasUrgent && (
            <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">
              ⚠️ {group.urgentCount} عاجل
            </span>
          )}
          <span className={`text-lg transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
        </div>
      </button>

      {/* ─ قائمة العناصر ─ */}
      {open && (
        <div className="divide-y divide-border border-t border-border bg-background">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {group.items.map(item => (
              <ElementRow key={item.id} item={item} onDecide={onDecide} busyId={busyId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── الصفحة الرئيسية ────────────────────────────────────────────
export default function ApprovalsPage() {
  const [grouped,  setGrouped]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState('');
  const [search,   setSearch]   = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/approvals-queue');
      setGrouped(res.data?.grouped || []);
      setTotal(res.data?.total || 0);
    } catch { setGrouped([]); setTotal(0); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDecide = async (trackingId, status, notes) => {
    setBusyId(trackingId);
    try {
      await api.put(`/closure/${trackingId}`, { status, notes });
      const msg = status === 'APPROVED' ? 'تم الاعتماد ✓' : status === 'RETURNED' ? 'أُعيد للموظف' : 'رُفض';
      toast.success(msg);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'تعذر تنفيذ الإجراء');
    } finally { setBusyId(''); }
  };

  // فلتر بالبحث
  const q = search.trim().toLowerCase();
  const filtered = q
    ? grouped.map(g => ({
        ...g,
        items: g.items.filter(i =>
          [i.employeeName, i.courseName, i.elementName, i.projectName]
            .some(v => v?.toLowerCase().includes(q))
        ),
      })).filter(g => g.items.length > 0)
    : grouped;

  const urgent   = grouped.reduce((s, g) => s + g.urgentCount + g.criticalCount, 0);
  const critical = grouped.reduce((s, g) => s + g.criticalCount, 0);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* ─ رأس الصفحة ─ */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="text-xl font-extrabold text-primary">طابور الاعتمادات</h1>
              <p className="mt-0.5 text-xs text-text-soft">مرتّب حسب الإلحاحية — مجمّع بالموظفين</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {critical > 0 && (
                <span className="flex items-center gap-1.5 rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-sm font-bold text-danger">
                  🚨 حرجة +48 ساعة <span className="rounded-full bg-danger px-2 py-0.5 text-white text-xs">{critical}</span>
                </span>
              )}
              {urgent > 0 && (
                <span className="flex items-center gap-1.5 rounded-xl border border-warning/30 bg-sand/10 px-3 py-2 text-sm font-bold text-warning">
                  ⚠️ متأخرة +24 ساعة <span className="rounded-full bg-warning px-2 py-0.5 text-white text-xs">{urgent - critical}</span>
                </span>
              )}
              <span className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-text-main">
                الإجمالي <span className="mr-1 rounded-full bg-primary px-2 py-0.5 text-white text-xs">{total}</span>
              </span>
              <button onClick={load} className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-bold text-text-main hover:bg-background">
                ↻ تحديث
              </button>
            </div>
          </div>

          {/* ─ بحث ─ */}
          <div className="border-t border-border px-5 py-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="🔍 ابحث باسم الموظف أو الدورة أو العنصر..."
              className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          </div>
        </div>

        {/* ─ المحتوى ─ */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
            <div className="flex items-center gap-2 text-text-soft">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              جاري التحميل...
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-white py-20 text-center shadow-card">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-extrabold text-text-main">
              {q ? 'لا نتائج للبحث' : 'لا توجد عناصر بانتظار الاعتماد'}
            </p>
            <p className="text-sm text-text-soft mt-1">
              {q ? 'جرّب كلمة بحث مختلفة' : 'جميع العناصر تمت معالجتها'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(group => (
              <EmployeeCard
                key={group.employeeId}
                group={group}
                onDecide={handleDecide}
                busyId={busyId}
              />
            ))}
          </div>
        )}

      </div>
    </MainLayout>
  );
}
