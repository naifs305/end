import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import useAuth from '../../context/AuthContext';
import { canCreateCourse, normalizeRole } from '../../lib/roles';
import Link from 'next/link';

// ─── ثوابت ────────────────────────────────────────────────────

const STATUS_CFG = {
  PREPARATION:      { label:'إعداد',        border:'border-s-[3px] border-s-border',    bg:'bg-white',         badge:'bg-background text-text-soft border-border',          dot:'bg-border' },
  IN_PROGRESS:      { label:'تنفيذ',        border:'border-s-[3px] border-s-primary',   bg:'bg-white',         badge:'bg-primary-light text-primary border-primary/20',     dot:'bg-primary' },
  EXECUTION:        { label:'تنفيذ',        border:'border-s-[3px] border-s-primary',   bg:'bg-white',         badge:'bg-primary-light text-primary border-primary/20',     dot:'bg-primary' },
  AWAITING_CLOSURE: { label:'انتظار إقفال', border:'border-s-[3px] border-s-warning',   bg:'bg-sand/5',        badge:'bg-sand/20 text-warning border-sand/40',             dot:'bg-warning' },
  CLOSED:           { label:'مقفلة',        border:'border-s-[3px] border-s-accent',    bg:'bg-forest-50/30',  badge:'bg-forest-50 text-accent border-accent/20',          dot:'bg-accent' },
  ARCHIVED:         { label:'مؤرشفة',       border:'border-s-[3px] border-s-text-soft', bg:'bg-background',    badge:'bg-border/60 text-text-soft border-border',           dot:'bg-text-soft' },
};

const STATUSES = [
  { value:'ALL',             label:'الكل' },
  { value:'PREPARATION',     label:'إعداد' },
  { value:'EXECUTION',       label:'تنفيذ' },
  { value:'AWAITING_CLOSURE',label:'انتظار إقفال' },
  { value:'CLOSED',          label:'مقفلة' },
];

function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
}

function empName(u) { return `${u?.firstName||''} ${u?.lastName||''}`.trim() || '-'; }

// ─── بطاقة دورة ───────────────────────────────────────────────

function CourseCard({ course, role, user, onDelete, onArchive, onReassign, busy }) {
  const cfg = STATUS_CFG[course.status] || STATUS_CFG.PREPARATION;
  const [actionsOpen, setActionsOpen] = useState(false);

  const isOwner     = course.primaryEmployeeId === user?.id;
  const canEdit     = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR' || (isOwner && course.status === 'PREPARATION');
  const canManage   = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR';
  const canDel      = canManage || (isOwner && course.status === 'PREPARATION');

  // حساب نسبة إنجاز الإقفال من _count
  const elCount = course._count?.closureElements ?? 0;

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-r-4 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${cfg.border}`}>
      {/* رأس البطاقة */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <Link href={`/courses/${course.id}`} className="flex-1 min-w-0">
            <h3 className="line-clamp-2 font-extrabold text-text-main leading-snug hover:text-primary transition text-sm">
              {course.name}
            </h3>
          </Link>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>

        {/* كود + مدينة */}
        {(course.code || course.city) && (
          <p className="mb-2 text-xs text-text-soft">
            {[course.code, course.city].filter(Boolean).join(' • ')}
          </p>
        )}

        {/* معلومات مضغوطة */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-soft">
          <span title="المسؤول">👤 {empName(course.primaryEmployee)}</span>
          <span title="المشروع">📁 {course.operationalProject?.name || '-'}</span>
          <span title="الفترة">📅 {fmtDate(course.startDate)} — {fmtDate(course.endDate)}</span>
          {elCount > 0 && <span title="عناصر الإقفال">📋 {elCount} عنصر</span>}
        </div>
      </div>

      {/* شريط الإجراءات */}
      <div className="flex items-center gap-1.5 border-t border-border bg-background px-3 py-2">
        <Link href={`/courses/${course.id}`}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-text-main hover:border-primary hover:text-primary transition">
          📂 فتح
        </Link>
        {canEdit && (
          <Link href={`/courses/${course.id}/edit`}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-text-main hover:border-primary hover:text-primary transition">
            ✏️ تعديل
          </Link>
        )}

        {/* قائمة إجراءات إضافية */}
        {canManage && (
          <div className="relative mr-auto">
            <button onClick={() => setActionsOpen(v => !v)}
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-soft hover:bg-background">
              ⋯
            </button>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
                <div className="absolute left-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-white shadow-soft">
                  <button onClick={() => { setActionsOpen(false); onReassign(course.id); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-main hover:bg-background">
                    🔄 نقل المسؤول
                  </button>
                  {course.status === 'CLOSED' && (
                    <button onClick={() => { setActionsOpen(false); onArchive(course.id); }} disabled={busy === course.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-soft hover:bg-background">
                      📁 أرشفة
                    </button>
                  )}
                  {canDel && (
                    <button onClick={() => { setActionsOpen(false); onDelete(course.id); }} disabled={busy === course.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-burgundy/5">
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!canManage && canDel && (
          <button onClick={() => onDelete(course.id)} disabled={busy === course.id}
            className="me-auto rounded-xl border border-burgundy/20 px-2.5 py-1.5 text-[11px] font-bold text-danger hover:bg-burgundy/5 disabled:opacity-50">
            حذف
          </button>
        )}
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────

export default function CoursesPage() {
  const router  = useRouter();
  const { activeRole, user } = useAuth();
  const role    = normalizeRole(activeRole) || 'EMPLOYEE';

  const [courses, setCourses]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busyId,  setBusyId]    = useState(null);
  const [filters, setFilters]   = useState({ search:'', status:'ALL', project:'', employee:'' });
  const [view,    setView]      = useState('grid');  // 'grid' | 'list'
  const [page,    setPage]      = useState(1);
  const PAGE = 12;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/courses', { params: { limit: 300 } });
      const d   = res.data;
      setCourses(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
    } catch { setCourses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // خيارات الفلتر
  const projectOptions  = useMemo(() => [...new Set(courses.map(c => c.operationalProject?.name).filter(Boolean))], [courses]);
  const employeeOptions = useMemo(() => [...new Set(courses.map(c => empName(c.primaryEmployee)).filter(Boolean))], [courses]);

  // فلترة + ترتيب
  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return courses
      .filter(c => {
        const ms = !q || [c.name, c.code, c.city, c.operationalProject?.name, empName(c.primaryEmployee)].some(v => v?.toLowerCase().includes(q));
        const mst = filters.status === 'ALL' || c.status === filters.status;
        const mp  = !filters.project  || c.operationalProject?.name === filters.project;
        const me  = !filters.employee || empName(c.primaryEmployee) === filters.employee;
        return ms && mst && mp && me;
      })
      .sort((a, b) => {
        const order = { AWAITING_CLOSURE: 0, EXECUTION: 1, PREPARATION: 2, CLOSED: 3, ARCHIVED: 4 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [courses, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paginated  = filtered.slice((page-1)*PAGE, page*PAGE);

  useEffect(() => { setPage(1); }, [filters]);

  // إحصائيات سريعة
  const counts = useMemo(() => {
    const m = {};
    for (const c of courses) m[c.status] = (m[c.status]||0) + 1;
    return m;
  }, [courses]);

  // إجراءات
  const handleDelete = async (id) => {
    if (!confirm('حذف هذه الدورة؟')) return;
    setBusyId(id);
    try { await api.delete(`/courses/${id}`); await load(); }
    catch (e) { alert(e?.response?.data?.message || 'تعذر الحذف'); }
    finally { setBusyId(null); }
  };

  const handleArchive = async (id) => {
    setBusyId(id);
    try { await api.post(`/courses/${id}/archive`); await load(); }
    catch (e) { alert(e?.response?.data?.message || 'تعذر الأرشفة'); }
    finally { setBusyId(null); }
  };

  const handleReassign = async (id) => {
    const uid = prompt('معرّف الموظف الجديد (ID):');
    if (!uid) return;
    setBusyId(id);
    try { await api.put(`/courses/${id}/reassign`, { primaryEmployeeId: uid }); await load(); }
    catch (e) { alert(e?.response?.data?.message || 'تعذر النقل'); }
    finally { setBusyId(null); }
  };

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* ─── رأس الصفحة ─── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="text-xl font-extrabold text-primary">إدارة الدورات</h1>
              <p className="mt-0.5 text-xs text-text-soft">{courses.length} دورة مسجلة — مرتبة حسب الأولوية</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => router.push('/archive')}
                className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background">
                📁 الأرشيف
              </button>
              {canCreateCourse(role) && (
                <button onClick={() => router.push('/courses/create')}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark">
                  + دورة جديدة
                </button>
              )}
            </div>
          </div>

          {/* إحصائيات سريعة */}
          {!loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-2.5">
              {STATUSES.filter(s => s.value !== 'ALL').map(s => counts[s.value] > 0 && (
                <button key={s.value}
                  onClick={() => setFilters(p => ({...p, status: p.status === s.value ? 'ALL' : s.value}))}
                  className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition
                    ${filters.status === s.value ? `${STATUS_CFG[s.value]?.badge} border-current` : 'border-border bg-background text-text-soft hover:border-primary/40'}`}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_CFG[s.value]?.dot}`} />
                  {s.label} ({counts[s.value]})
                </button>
              ))}
              <span className="mr-auto rounded-xl border border-border bg-background px-2.5 py-1 text-xs text-text-soft">
                يُعرض {filtered.length} من {courses.length}
              </span>
            </div>
          )}
        </div>

        {/* ─── شريط الفلتر ─── */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <input value={filters.search}
            onChange={e => setFilters(p => ({...p, search: e.target.value}))}
            placeholder="🔍 ابحث باسم الدورة أو الكود أو المدينة..."
            className="min-w-[200px] flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />

          {projectOptions.length > 1 && (
            <select value={filters.project} onChange={e => setFilters(p => ({...p, project: e.target.value}))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">كل المشاريع</option>
              {projectOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}

          {employeeOptions.length > 1 && (role === 'MANAGER' || role === 'PROJECT_SUPERVISOR') && (
            <select value={filters.employee} onChange={e => setFilters(p => ({...p, employee: e.target.value}))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
              <option value="">كل المنسقين</option>
              {employeeOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}

          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ search:'', status:'ALL', project:'', employee:'' })}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">✕</button>
          )}

          <div className="mr-auto flex rounded-xl border border-border overflow-hidden">
            <button onClick={() => setView('grid')} className={`px-3 py-2 text-xs font-bold transition ${view === 'grid' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>⊞</button>
            <button onClick={() => setView('list')} className={`px-3 py-2 text-xs font-bold transition ${view === 'list' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>≡</button>
          </div>
        </div>

        {/* ─── المحتوى ─── */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-text-soft">جاري تحميل الدورات...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
            <div className="text-4xl mb-2">📚</div>
            <p className="font-bold text-text-main">لا توجد دورات</p>
            <p className="text-sm text-text-soft mt-1">
              {Object.values(filters).some(Boolean) ? 'جرّب تغيير الفلتر' : canCreateCourse(role) ? 'ابدأ بإضافة دورة جديدة' : 'لا توجد دورات مسندة لك'}
            </p>
            {canCreateCourse(role) && !Object.values(filters).some(Boolean) && (
              <button onClick={() => router.push('/courses/create')}
                className="mt-3 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark">
                + إضافة دورة
              </button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginated.map(c => (
              <CourseCard key={c.id} course={c} role={role} user={user}
                onDelete={handleDelete} onArchive={handleArchive} onReassign={handleReassign} busy={busyId} />
            ))}
          </div>
        ) : (
          /* عرض قائمة */
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="divide-y divide-border">
              {paginated.map(c => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.PREPARATION;
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-background ${busyId === c.id ? 'opacity-50' : ''}`}>
                    <span className={`h-8 w-1 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>{cfg.label}</span>
                        <Link href={`/courses/${c.id}`} className="font-bold text-sm text-text-main hover:text-primary truncate">{c.name}</Link>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-text-soft">
                        <span>👤 {empName(c.primaryEmployee)}</span>
                        <span>📁 {c.operationalProject?.name || '-'}</span>
                        <span>📅 {fmtDate(c.startDate)} — {fmtDate(c.endDate)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Link href={`/courses/${c.id}`} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold hover:border-primary hover:text-primary">فتح</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── ترقيم الصفحات ─── */}
        {!loading && filtered.length > PAGE && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
            <span className="text-xs text-text-soft">
              عرض {(page-1)*PAGE+1} — {Math.min(page*PAGE, filtered.length)} من {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">السابق</button>
              <span className="text-xs font-bold text-primary">{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">التالي</button>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
}
