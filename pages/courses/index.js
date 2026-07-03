import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import useAuth from '../../context/AuthContext';
import { canCreateCourse, normalizeRole } from '../../lib/roles';
import Link from 'next/link';
import toast from 'react-hot-toast';

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
  return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { year:'numeric', month:'short', day:'numeric' });
}

function empName(u) { return `${u?.firstName||''} ${u?.lastName||''}`.trim() || '-'; }

// ─── بطاقة دورة ───────────────────────────────────────────────

function CourseCard({ course, role, user, onDelete, onArchive, onReassign, busy }) {
  const cfg = STATUS_CFG[course.status] || STATUS_CFG.PREPARATION;

  const isOwner     = course.primaryEmployeeId === user?.id;
  const canEdit     = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR' || (isOwner && course.status === 'PREPARATION');
  const canManage   = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR';
  const canDel      = canManage || (isOwner && course.status === 'PREPARATION');

  // حساب نسبة إنجاز الإقفال من _count
  const elCount = course._count?.closureElements ?? 0;

  return (
    <div className={`group relative rounded-2xl border border-r-4 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${cfg.border}`}>
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
      <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background px-3 py-2">
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

        {/* أزرار المدير / المشرف — مباشرة بدون dropdown */}
        {canManage && (
          <>
            <button
              onClick={() => onReassign(course.id)}
              disabled={busy === course.id}
              className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-main hover:border-primary hover:text-primary transition disabled:opacity-50">
              🔄 نقل
            </button>
            {course.status === 'CLOSED' && (
              <button
                onClick={() => onArchive(course.id)}
                disabled={busy === course.id}
                className="rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-soft hover:bg-background transition disabled:opacity-50">
                📁 أرشفة
              </button>
            )}
            <button
              onClick={() => onDelete(course.id, course.name)}
              disabled={busy === course.id}
              className="rounded-lg border border-burgundy/20 bg-white px-2.5 py-1.5 text-[11px] font-bold text-danger hover:bg-burgundy/5 transition disabled:opacity-50">
              🗑️ حذف
            </button>
          </>
        )}

        {!canManage && canDel && (
          <button onClick={() => onDelete(course.id, course.name)} disabled={busy === course.id}
            className="rounded-lg border border-burgundy/20 px-2.5 py-1.5 text-[11px] font-bold text-danger hover:bg-burgundy/5 disabled:opacity-50">
            🗑️ حذف
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
  const [filters, setFilters]   = useState({ search:'', status:'ALL', project:'', employee:'', courseType:'', hasAdvance:'', incomplete:'' });
  const [sortBy,  setSortBy]    = useState('priority'); // 'priority' | 'newest' | 'oldest'
  const [view,    setView]      = useState('grid');  // 'grid' | 'list'
  const [page,    setPage]      = useState(1);
  const PAGE = 12;

  // ── modal نقل المسؤول ──
  const [reassignModal, setReassignModal] = useState(null); // { courseId, courseName }
  const [allUsers,      setAllUsers]      = useState([]);
  const [selUser,       setSelUser]       = useState('');
  const [reassigning,   setReassigning]   = useState(false);

  // ── modal تأكيد الحذف ──
  const [deleteModal, setDeleteModal] = useState(null); // { courseId, courseName }
  const [deleting,    setDeleting]    = useState(false);

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
        const ms  = !q || [c.name, c.code, c.city, c.operationalProject?.name, empName(c.primaryEmployee)].some(v => v?.toLowerCase().includes(q));
        const mst = filters.status === 'ALL' || c.status === filters.status;
        const mp  = !filters.project  || c.operationalProject?.name === filters.project;
        const me  = !filters.employee || empName(c.primaryEmployee) === filters.employee;
        // فلاتر جديدة
        const mct = !filters.courseType || c.courseType === filters.courseType;
        const mha = !filters.hasAdvance || (filters.hasAdvance === 'yes' ? c.requiresAdvance : !c.requiresAdvance);
        const hasIncomplete = c.closureElements?.some(el => el.status !== 'APPROVED' && el.status !== 'NOT_APPLICABLE');
        const mic = !filters.incomplete || (filters.incomplete === 'yes' ? hasIncomplete : !hasIncomplete);
        return ms && mst && mp && me && mct && mha && mic;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        // priority (افتراضي)
        const order = { AWAITING_CLOSURE: 0, EXECUTION: 1, PREPARATION: 2, CLOSED: 3, ARCHIVED: 4 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [courses, filters, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paginated  = filtered.slice((page-1)*PAGE, page*PAGE);

  useEffect(() => { setPage(1); }, [filters]);

  // إحصائيات سريعة
  const counts = useMemo(() => {
    const m = {};
    for (const c of courses) m[c.status] = (m[c.status]||0) + 1;
    return m;
  }, [courses]);

  // ── جلب قائمة الموظفين عند فتح modal النقل ──
  const openReassign = async (courseId, courseName) => {
    setSelUser('');
    setReassignModal({ courseId, courseName });
    if (allUsers.length === 0) {
      try {
        const res = await api.get('/users', { params: { limit: 200 } });
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setAllUsers(list.filter(u => u.isActive !== false));
      } catch { toast.error('تعذر جلب قائمة الموظفين'); }
    }
  };

  const confirmReassign = async () => {
    if (!selUser) { toast.error('يرجى اختيار موظف'); return; }
    setReassigning(true);
    try {
      await api.put(`/courses/${reassignModal.courseId}/reassign`, { primaryEmployeeId: selUser });
      toast.success('تم نقل الدورة بنجاح ✓');
      setReassignModal(null);
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'تعذر النقل'); }
    finally { setReassigning(false); }
  };

  // ── حذف الدورة ──
  const openDelete = (courseId, courseName) => setDeleteModal({ courseId, courseName });

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${deleteModal.courseId}`);
      toast.success('تم حذف الدورة');
      setDeleteModal(null);
      await load();
    } catch (e) { toast.error(e?.response?.data?.message || 'تعذر الحذف'); }
    finally { setDeleting(false); }
  };

  // إجراءات (للتوافق مع CourseCard)
  const handleDelete  = (id, name) => openDelete(id, name);
  const handleArchive = async (id) => {
    setBusyId(id);
    try { await api.post(`/courses/${id}/archive`); toast.success('تم أرشفة الدورة'); await load(); }
    catch (e) { toast.error(e?.response?.data?.message || 'تعذر الأرشفة'); }
    finally { setBusyId(null); }
  };
  const handleReassign = (id, name) => openReassign(id, name);

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

          {/* ── فلاتر سريعة: نوع الدورة ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { val:'',         label:'كل الأنواع' },
              { val:'internal', label:'🏛️ داخلية' },
              { val:'external', label:'✈️ خارجية' },
            ].map(o => (
              <button key={o.val}
                onClick={() => setFilters(p => ({...p, courseType: p.courseType === o.val ? '' : o.val}))}
                className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition
                  ${filters.courseType === o.val && o.val !== ''
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-border bg-white text-text-soft hover:border-primary/40'}`}>
                {o.label}
              </button>
            ))}
          </div>

          {/* ── فلاتر سريعة: السلفة والعناصر ── */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilters(p => ({...p, hasAdvance: p.hasAdvance === 'yes' ? '' : 'yes'}))}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition
                ${filters.hasAdvance === 'yes' ? 'border-warning bg-sand/20 text-warning' : 'border-border bg-white text-text-soft hover:border-warning/40'}`}>
              💰 بها سلفة
            </button>
            <button
              onClick={() => setFilters(p => ({...p, incomplete: p.incomplete === 'yes' ? '' : 'yes'}))}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition
                ${filters.incomplete === 'yes' ? 'border-danger bg-burgundy/10 text-danger' : 'border-border bg-white text-text-soft hover:border-danger/40'}`}>
              ⚠️ عناصر ناقصة
            </button>
          </div>

          {/* ── مسح الفلاتر ── */}
          {Object.values(filters).some(Boolean) && (
            <button onClick={() => setFilters({ search:'', status:'ALL', project:'', employee:'', courseType:'', hasAdvance:'', incomplete:'' })}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">✕</button>
          )}

          {/* ── ترتيب + عرض ── */}
          <div className="mr-auto flex items-center gap-2">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main outline-none focus:border-primary">
              <option value="priority">🔺 حسب الأولوية</option>
              <option value="newest">🕐 الأحدث إدخالاً</option>
              <option value="oldest">🕐 الأقدم إدخالاً</option>
            </select>
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button onClick={() => setView('grid')} className={`px-3 py-2 text-xs font-bold transition ${view === 'grid' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>⊞</button>
              <button onClick={() => setView('list')} className={`px-3 py-2 text-xs font-bold transition ${view === 'list' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}>≡</button>
            </div>
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
                onDelete={handleDelete} onArchive={handleArchive}
                onReassign={(id) => openReassign(id, c.name)} busy={busyId} />
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

      {/* ══ Modal نقل المسؤول ══════════════════════════════════════ */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-extrabold text-primary">🔄 نقل المسؤول</h2>
              <p className="mt-0.5 text-xs text-text-soft truncate">الدورة: {reassignModal.courseName}</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-text-main">
                  اختر الموظف الجديد المسؤول <span className="text-danger">*</span>
                </label>
                {allUsers.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-text-soft py-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    جاري تحميل الموظفين...
                  </div>
                ) : (
                  <select
                    value={selUser}
                    onChange={e => setSelUser(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">— اختر موظفاً —</option>
                    {allUsers
                      .filter(u => u.roles?.includes('EMPLOYEE') || u.roles?.includes('PROJECT_SUPERVISOR'))
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                          {u.operationalProject?.name ? ` — ${u.operationalProject.name}` : ''}
                        </option>
                      ))
                    }
                  </select>
                )}
              </div>
              <p className="rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs text-warning">
                ⚠️ سيُنقل جميع مسؤوليات هذه الدورة للموظف المختار. تأكد من اختيارك قبل التأكيد.
              </p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button
                onClick={confirmReassign}
                disabled={reassigning || !selUser}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {reassigning ? '...' : '✓ تأكيد النقل'}
              </button>
              <button
                onClick={() => setReassignModal(null)}
                disabled={reassigning}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal تأكيد الحذف ══════════════════════════════════════ */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white shadow-2xl">
            <div className="p-5 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/10 text-3xl">
                🗑️
              </div>
              <h2 className="text-base font-extrabold text-text-main">حذف الدورة</h2>
              <p className="text-sm text-text-soft">
                سيتم حذف الدورة
                <span className="mx-1 font-bold text-text-main">"{deleteModal.courseName}"</span>
                وجميع بياناتها نهائياً.
              </p>
              <p className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">
                هذا الإجراء لا يمكن التراجع عنه
              </p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-danger py-2.5 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50"
              >
                {deleting ? '...' : '🗑️ نعم، احذف'}
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
}
