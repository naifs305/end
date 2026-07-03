import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import useAuth from '../context/AuthContext';

// ══════════════════════════════════════════════════════════════════════
// أدوات مشتركة
// ══════════════════════════════════════════════════════════════════════

function fmtDT(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' });
}
function waitLabel(h) {
  if (h < 1)  return 'أقل من ساعة';
  if (h < 24) return `${h}س`;
  const d = Math.floor(h / 24), r = h % 24;
  return r > 0 ? `${d}ي ${r}س` : `${d} يوم`;
}

const ELEMENT_ICON = {
  opening_report:'📋', closing_report:'📝', advance_req:'💰', settlement:'🧾',
  supervisor_compensation:'👤', trainer_compensation:'🎓', revenues:'📊',
  materials:'📦', certificates:'🏆', pre_test:'✏️', post_test:'✅',
  trainee_registration:'👥', registration_message:'📨', reaction_evaluation:'⭐',
  medical_insurance:'🏥',
};

const STATUS_COURSE = {
  PREPARATION:      { label:'إعداد',         cls:'bg-background text-text-soft' },
  EXECUTION:        { label:'تنفيذ',         cls:'bg-primary-light text-primary' },
  AWAITING_CLOSURE: { label:'انتظار إقفال', cls:'bg-sand/20 text-warning' },
  CLOSED:           { label:'مغلقة',          cls:'bg-forest-50 text-accent' },
};

// ══════════════════════════════════════════════════════════════════════
// حلقة SVG للنسبة المئوية
// ══════════════════════════════════════════════════════════════════════
function Ring({ pct, size = 56, stroke = 5, color }) {
  const r   = (size - stroke) / 2;
  const c   = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  const col = color || (pct >= 80 ? '#5D8A70' : pct >= 50 ? '#C3B39F' : '#633646');
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EBF3EE" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset .6s ease' }}/>
    </svg>
  );
}

// شريط ملوّن مقسّم (معتمد/معلق/مُعاد/لم يبدأ)
function StackedBar({ approved, pending, returned, notStarted, total }) {
  if (!total) return null;
  const w = (n) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-border/30">
      {approved   > 0 && <div className="h-full bg-accent transition-all"   style={{ width: w(approved) }}   title={`معتمد: ${approved}`}/>}
      {pending    > 0 && <div className="h-full bg-warning transition-all"  style={{ width: w(pending) }}    title={`معلق: ${pending}`}/>}
      {returned   > 0 && <div className="h-full bg-danger transition-all"   style={{ width: w(returned) }}   title={`مُعاد: ${returned}`}/>}
      {notStarted > 0 && <div className="h-full bg-border transition-all"   style={{ width: w(notStarted) }} title={`لم يبدأ: ${notStarted}`}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ▌لوحة مراقبة المدير
// ══════════════════════════════════════════════════════════════════════

function CourseOversightRow({ course }) {
  const s = STATUS_COURSE[course.status] || { label: course.status, cls: 'bg-background text-text-soft' };
  const { approved, pending, returned, notStarted, total } = course.elements;
  return (
    <Link href={`/courses/${course.id}`}>
      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 hover:border-primary/30 hover:bg-background transition cursor-pointer
        ${course.isOverdue ? 'border-danger/20 bg-burgundy/5' : 'border-border bg-white'}`}>

        {/* حالة الدورة */}
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${s.cls}`}>{s.label}</span>

        {/* اسم + تاريخ */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-text-main">{course.name}</p>
          <p className="text-[10px] text-text-soft mt-0.5">
            {fmtDate(course.startDate)} — {fmtDate(course.endDate)}
            {course.isOverdue && <span className="mr-2 font-bold text-danger">⚠️ متأخرة</span>}
          </p>
        </div>

        {/* شريط + أرقام */}
        <div className="shrink-0 w-40 space-y-1.5 hidden sm:block">
          <StackedBar approved={approved} pending={pending} returned={returned} notStarted={notStarted} total={total}/>
          <div className="flex gap-2 text-[10px] justify-between">
            {approved   > 0 && <span className="text-accent font-bold">✓{approved}</span>}
            {pending    > 0 && <span className="text-warning font-bold">⏳{pending}</span>}
            {returned   > 0 && <span className="text-danger font-bold">↩{returned}</span>}
            {notStarted > 0 && <span className="text-text-soft">○{notStarted}</span>}
          </div>
        </div>

        {/* نسبة مئوية */}
        <span className={`shrink-0 text-sm font-extrabold w-10 text-left
          ${course.completionPct >= 80 ? 'text-accent' : course.completionPct >= 50 ? 'text-warning' : 'text-danger'}`}>
          {course.completionPct}%
        </span>
      </div>
    </Link>
  );
}

function EmployeeOversightCard({ emp }) {
  const [open, setOpen] = useState(
    emp.summary.overdueCourses > 0 || emp.summary.pendingElements > 0
  );
  const { completionPct, totalCourses, overdueCourses, approvedElements, totalElements, pendingElements, returnedElements } = emp.summary;
  const hasIssues = overdueCourses > 0 || returnedElements > 0;
  const hasPending = pendingElements > 0;

  return (
    <div className={`overflow-hidden rounded-2xl border shadow-card transition
      ${hasIssues ? 'border-danger/25' : hasPending ? 'border-warning/25' : 'border-border'}`}>

      {/* ─ رأس البطاقة ─ */}
      <button onClick={() => setOpen(v => !v)}
        className={`flex w-full items-center gap-4 px-5 py-4 text-start transition hover:bg-background
          ${hasIssues ? 'bg-burgundy/5' : hasPending ? 'bg-sand/10' : 'bg-white'}`}>

        {/* حلقة النسبة */}
        <div className="relative shrink-0">
          <Ring pct={completionPct} size={60} stroke={5}/>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-text-main">
            {completionPct}%
          </span>
        </div>

        {/* معلومات الموظف */}
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-base text-text-main">{emp.name}</p>
          <p className="text-xs text-text-soft">{emp.projectName}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] font-bold text-text-soft">
              {totalCourses} دورة
            </span>
            <span className="rounded-full bg-forest-50 border border-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">
              ✓ {approvedElements}/{totalElements}
            </span>
            {pendingElements > 0 && (
              <span className="rounded-full bg-sand/20 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">
                ⏳ {pendingElements} معلق
              </span>
            )}
            {returnedElements > 0 && (
              <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">
                ↩ {returnedElements} مُعاد
              </span>
            )}
            {overdueCourses > 0 && (
              <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">
                ⚠️ {overdueCourses} دورة متأخرة
              </span>
            )}
          </div>
        </div>

        {/* شريط إجمالي */}
        <div className="shrink-0 w-32 space-y-1 hidden md:block">
          <StackedBar
            approved={approvedElements} pending={pendingElements}
            returned={returnedElements}
            notStarted={totalElements - approvedElements - pendingElements - returnedElements}
            total={totalElements}/>
          <div className="flex justify-between text-[10px] text-text-soft">
            <span>🟢 معتمد</span><span>🟡 معلق</span><span>🔴 مُعاد</span>
          </div>
        </div>

        <span className={`text-lg shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {/* ─ قائمة الدورات ─ */}
      {open && (
        <div className="border-t border-border bg-background p-4 space-y-2">
          {emp.courses.length === 0 ? (
            <p className="text-center text-sm text-text-soft py-4">لا توجد دورات</p>
          ) : (
            emp.courses.map(c => <CourseOversightRow key={c.id} course={c}/>)
          )}
        </div>
      )}
    </div>
  );
}

function ManagerOversight() {
  const [employees, setEmployees] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('all'); // all | issues | pending

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/oversight')
      .then(r => setEmployees(r.data?.employees || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = employees
    .filter(e => {
      if (filter === 'issues')  return e.summary.overdueCourses > 0 || e.summary.returnedElements > 0;
      if (filter === 'pending') return e.summary.pendingElements > 0;
      return true;
    })
    .filter(e => !q || e.name.toLowerCase().includes(q) || e.projectName.toLowerCase().includes(q));

  const totalPending  = employees.reduce((s,e) => s + e.summary.pendingElements, 0);
  const totalOverdue  = employees.reduce((s,e) => s + e.summary.overdueCourses, 0);
  const totalReturned = employees.reduce((s,e) => s + e.summary.returnedElements, 0);

  return (
    <div className="space-y-4">
      {/* ─ رأس ─ */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold text-primary">لوحة المراقبة</h1>
            <p className="mt-0.5 text-xs text-text-soft">نظرة شاملة على أداء الموظفين وحالة الإقفال</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {totalOverdue > 0 && (
              <span className="rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                ⚠️ {totalOverdue} دورة متأخرة
              </span>
            )}
            {totalPending > 0 && (
              <span className="rounded-xl border border-warning/30 bg-sand/10 px-3 py-2 text-xs font-bold text-warning">
                ⏳ {totalPending} عنصر معلق
              </span>
            )}
            {totalReturned > 0 && (
              <span className="rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                ↩ {totalReturned} عنصر مُعاد
              </span>
            )}
          </div>
        </div>

        {/* ─ أسطورة الألوان ─ */}
        <div className="flex flex-wrap gap-3 border-t border-border px-5 py-2.5 text-[11px]">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-accent"/><span className="text-text-soft">معتمد</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-warning"/><span className="text-text-soft">معلق (بانتظار المشرف)</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-danger"/><span className="text-text-soft">مُعاد للموظف</span></span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-5 rounded-full bg-border"/><span className="text-text-soft">لم يبدأ</span></span>
        </div>

        {/* ─ فلاتر + بحث ─ */}
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ابحث باسم الموظف أو المشروع..."
            className="flex-1 min-w-[180px] rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"/>
          {[
            { val:'all',     label:'الكل' },
            { val:'issues',  label:'⚠️ يحتاج تدخل' },
            { val:'pending', label:'⏳ به معلق' },
          ].map(o => (
            <button key={o.val} onClick={() => setFilter(o.val)}
              className={`rounded-xl border px-3 py-2 text-xs font-bold transition
                ${filter === o.val ? 'border-primary bg-primary-light text-primary' : 'border-border bg-white text-text-soft hover:border-primary/40'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─ المحتوى ─ */}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20 shadow-card">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-20 text-center shadow-card">
          <p className="text-3xl mb-2">👥</p>
          <p className="font-extrabold text-text-main">لا توجد نتائج</p>
          <p className="text-sm text-text-soft mt-1">جرّب تغيير الفلتر أو البحث</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(emp => <EmployeeOversightCard key={emp.id} emp={emp}/>)}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ▌قائمة اعتمادات المشرف (محسّنة)
// ══════════════════════════════════════════════════════════════════════

function WaitBadge({ hours }) {
  if (hours < 6)  return <span className="rounded-full bg-forest-50 border border-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent">{waitLabel(hours)}</span>;
  if (hours < 24) return <span className="rounded-full bg-sand/20 border border-sand/40 px-2 py-0.5 text-[10px] font-bold text-warning">{waitLabel(hours)}</span>;
  if (hours < 48) return <span className="rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-600">⚠️ {waitLabel(hours)}</span>;
  return <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">🚨 {waitLabel(hours)}</span>;
}

function ApprovalElementRow({ item, onDecide, busyId }) {
  const [mode, setMode]     = useState(null); // 'RETURNED' | 'REJECTED'
  const [reason, setReason] = useState('');
  const busy = busyId === item.id;
  const icon = ELEMENT_ICON[item.elementKey] || '📄';

  const confirm = async (status) => {
    if ((status === 'RETURNED' || status === 'REJECTED') && !reason.trim()) {
      toast.error('السبب مطلوب'); return;
    }
    await onDecide(item.id, status, reason);
    setMode(null); setReason('');
  };

  return (
    <div className={`rounded-xl border bg-white p-3 space-y-2
      ${item.isCritical ? 'border-danger/30' : item.isUrgent ? 'border-warning/30' : 'border-border'}`}>

      {/* رأس */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg mt-0.5">{icon}</span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-text-main">{item.elementName}</p>
            <Link href={`/courses/${item.courseId}`}
              className="text-xs text-primary font-bold hover:underline truncate block">
              {item.courseName} {item.courseCode && <span className="text-text-soft font-normal">· {item.courseCode}</span>}
            </Link>
          </div>
        </div>
        <WaitBadge hours={item.waitHours}/>
      </div>

      {/* مسار */}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-lg bg-primary-light border border-primary/20 px-2 py-1 text-primary font-bold">
          ✓ قدّمه {item.employeeName} {fmtDT(item.submittedAt)}
        </span>
        {item.wasReturned && (
          <>
            <span className="text-text-soft">→</span>
            <span className="rounded-lg bg-sand/20 border border-sand/40 px-2 py-1 text-warning font-bold">↩ أُعيد</span>
            <span className="text-text-soft">→</span>
            <span className="rounded-lg bg-primary-light border border-primary/20 px-2 py-1 text-primary font-bold">✓ أُعيد تقديمه</span>
          </>
        )}
        <span className="text-text-soft">→</span>
        <span className="rounded-lg bg-sand/10 border border-sand/30 px-2 py-1 text-warning font-bold animate-pulse">⏳ بانتظار قرارك</span>
      </div>

      {/* سبب إعادة سابقة */}
      {item.wasReturned && item.notes && (
        <div className="rounded-lg border border-sand/40 bg-sand/10 px-3 py-1.5 text-xs text-warning">
          <span className="font-bold">سبب الإعادة: </span>{item.notes}
        </div>
      )}
      {item.delayReason && (
        <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-text-soft">
          <span className="font-bold text-text-main">مبرر الموظف: </span>{item.delayReason}
        </div>
      )}

      {/* أزرار */}
      {!mode ? (
        <div className="flex gap-2 pt-0.5">
          <button onClick={() => onDecide(item.id, 'APPROVED', '')} disabled={busy}
            className="rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            {busy ? '...' : '✓ اعتماد'}
          </button>
          <button onClick={() => { setMode('RETURNED'); setReason(''); }} disabled={busy}
            className="rounded-xl bg-warning px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            ↩ إعادة
          </button>
          <button onClick={() => { setMode('REJECTED'); setReason(''); }} disabled={busy}
            className="rounded-xl bg-danger px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50">
            ✕ رفض
          </button>
        </div>
      ) : (
        <div className={`rounded-xl border p-3 space-y-2 ${mode === 'RETURNED' ? 'border-sand/40 bg-sand/10' : 'border-burgundy/20 bg-burgundy/5'}`}>
          <p className={`text-xs font-bold ${mode === 'RETURNED' ? 'text-warning' : 'text-danger'}`}>
            {mode === 'RETURNED' ? 'سبب الإعادة (مطلوب)' : 'سبب الرفض (مطلوب)'}
          </p>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            rows={2} maxLength={400} placeholder="وضّح للموظف..."
            className="w-full resize-none rounded-lg border border-white/60 bg-white px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-current"/>
          <div className="flex gap-2">
            <button onClick={() => confirm(mode)} disabled={busy}
              className={`rounded-xl px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${mode === 'RETURNED' ? 'bg-warning' : 'bg-danger'}`}>
              {busy ? '...' : 'تأكيد'}
            </button>
            <button onClick={() => setMode(null)}
              className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-soft">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupervisorApprovals() {
  const [grouped,  setGrouped]  = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [busyId,   setBusyId]   = useState('');
  const [search,   setSearch]   = useState('');
  const [openIds,  setOpenIds]  = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/approvals-queue');
      const g = res.data?.grouped || [];
      setGrouped(g);
      setTotal(res.data?.total || 0);
      // افتح تلقائياً الموظفين العاجلين
      const autoOpen = new Set(g.filter(x => x.criticalCount > 0 || x.urgentCount > 0).map(x => x.employeeId));
      setOpenIds(autoOpen);
    } catch { setGrouped([]); setTotal(0); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDecide = async (id, status, notes) => {
    setBusyId(id);
    try {
      await api.put(`/closure/${id}`, { status, notes });
      toast.success(status === 'APPROVED' ? 'تم الاعتماد ✓' : status === 'RETURNED' ? 'أُعيد للموظف' : 'رُفض');
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || 'تعذر تنفيذ الإجراء'); }
    finally { setBusyId(''); }
  };

  const toggleOpen = (id) => setOpenIds(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? grouped.map(g => ({ ...g, items: g.items.filter(i => [i.employeeName, i.courseName, i.elementName].some(v => v?.toLowerCase().includes(q))) })).filter(g => g.items.length > 0)
    : grouped;

  const urgent   = grouped.reduce((s, g) => s + g.urgentCount, 0);
  const critical = grouped.reduce((s, g) => s + g.criticalCount, 0);

  return (
    <div className="space-y-4">
      {/* رأس */}
      <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold text-primary">طابور الاعتمادات</h1>
            <p className="mt-0.5 text-xs text-text-soft">مجمّع بالموظفين — الأكثر إلحاحاً أولاً</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {critical > 0 && <span className="rounded-xl border border-danger/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">🚨 +48 ساعة: {critical}</span>}
            {urgent   > 0 && <span className="rounded-xl border border-warning/30 bg-sand/10 px-3 py-2 text-xs font-bold text-warning">⚠️ +24 ساعة: {urgent - critical}</span>}
            <span className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text-main">
              الإجمالي <span className="mr-1 rounded-full bg-primary px-2 py-0.5 text-white text-xs">{total}</span>
            </span>
            <button onClick={load} className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold hover:bg-background">↻</button>
          </div>
        </div>
        <div className="border-t border-border px-5 py-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ابحث باسم الموظف أو الدورة أو العنصر..."
            className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"/>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-20"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"/></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-20 text-center shadow-card">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-extrabold text-text-main">{q ? 'لا نتائج' : 'لا توجد عناصر بانتظار الاعتماد'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(group => {
            const isOpen = openIds.has(group.employeeId);
            return (
              <div key={group.employeeId}
                className={`overflow-hidden rounded-2xl border shadow-card
                  ${group.criticalCount > 0 ? 'border-danger/30' : group.urgentCount > 0 ? 'border-warning/30' : 'border-border'}`}>
                <button onClick={() => toggleOpen(group.employeeId)}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-4 hover:bg-background transition
                    ${group.criticalCount > 0 ? 'bg-burgundy/5' : group.urgentCount > 0 ? 'bg-sand/10' : 'bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white
                      ${group.criticalCount > 0 ? 'bg-danger' : group.urgentCount > 0 ? 'bg-warning' : 'bg-primary'}`}>
                      {group.employeeName.charAt(0)}
                    </div>
                    <div className="text-start">
                      <p className="font-extrabold text-text-main">{group.employeeName}</p>
                      <p className="text-xs text-text-soft">{group.projectName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-white">{group.items.length} عنصر</span>
                    {group.criticalCount > 0 && <span className="rounded-full bg-danger px-2 py-0.5 text-[10px] font-bold text-white">🚨 {group.criticalCount}</span>}
                    {group.urgentCount   > 0 && <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold text-white">⚠️ {group.urgentCount}</span>}
                    <span className={`text-lg transition-transform ${isOpen ? 'rotate-180' : ''}`}>⌄</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.items.map(item => (
                        <ApprovalElementRow key={item.id} item={item} onDecide={handleDecide} busyId={busyId}/>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ▌الصفحة الرئيسية — توزيع حسب الدور
// ══════════════════════════════════════════════════════════════════════
export default function ApprovalsPage() {
  const { activeRole } = useAuth();
  const isManager = activeRole === 'MANAGER';

  return (
    <MainLayout>
      {isManager ? <ManagerOversight/> : <SupervisorApprovals/>}
    </MainLayout>
  );
}
