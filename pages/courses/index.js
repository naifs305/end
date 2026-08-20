
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Archive,
  Plus,
  Search,
  Building2,
  Plane,
  Coins,
  AlertTriangle,
  X,
  LayoutGrid,
  List,
  User,
  FolderKanban,
  Calendar,
  ClipboardList,
  FolderOpen,
  Pencil,
  ArrowLeftRight,
  Trash2,
  BookOpen,
  Check,
} from 'lucide-react';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import useAuth from '../../context/AuthContext';
import { canCreateCourse, normalizeRole } from '../../lib/roles';
import { useTranslation } from '../../lib/i18n';

// ─── إعدادات الحالة (الأنماط فقط؛ التسميات من الترجمة) ──────────
const STATUS_CFG = {
  PREPARATION: { border: 'border-s-[3px] border-s-border', badge: 'bg-background text-text-soft border-border', dot: 'bg-border' },
  IN_PROGRESS: { border: 'border-s-[3px] border-s-primary', badge: 'bg-primary-light text-primary border-primary/20', dot: 'bg-primary' },
  EXECUTION: { border: 'border-s-[3px] border-s-primary', badge: 'bg-primary-light text-primary border-primary/20', dot: 'bg-primary' },
  AWAITING_CLOSURE: { border: 'border-s-[3px] border-s-warning', badge: 'bg-sand/20 text-warning border-sand/40', dot: 'bg-warning' },
  CLOSED: { border: 'border-s-[3px] border-s-accent', badge: 'bg-forest-50 text-accent border-accent/20', dot: 'bg-accent' },
  ARCHIVED: { border: 'border-s-[3px] border-s-text-soft', badge: 'bg-border/60 text-text-soft border-border', dot: 'bg-text-soft' },
};

// تسمية الحالة من الترجمة (مع تحويل القيمة القديمة IN_PROGRESS)
function statusLabel(t, status) {
  const key = status === 'IN_PROGRESS' ? 'EXECUTION' : status;
  return t(`courseStatus.${key}`);
}

const STAT_STATUSES = ['PREPARATION', 'EXECUTION', 'AWAITING_CLOSURE', 'CLOSED'];

function empName(u) {
  return `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || '-';
}

// ─── بطاقة دورة ───────────────────────────────────────────────
function CourseCard({ course, role, user, onDelete, onArchive, onReassign, busy, t, fmtDate }) {
  const cfg = STATUS_CFG[course.status] || STATUS_CFG.PREPARATION;
  const isOwner = course.primaryEmployeeId === user?.id;
  const canEdit = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR' || (isOwner && course.status === 'PREPARATION');
  const canManage = role === 'MANAGER' || role === 'PROJECT_SUPERVISOR';
  const canDel = canManage || (isOwner && course.status === 'PREPARATION');
  const elCount = course._count?.closureElements ?? 0;

  return (
    <div className={`group relative rounded-2xl border border-r-4 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-soft ${cfg.border}`}>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <Link href={`/courses/${course.id}`} className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-extrabold leading-snug text-text-main transition hover:text-primary">
              {course.name}
            </h3>
          </Link>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
            {statusLabel(t, course.status)}
          </span>
        </div>

        {(course.code || course.city) && (
          <p className="mb-2 text-xs text-text-soft">{[course.code, course.city].filter(Boolean).join(' • ')}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-text-soft">
          <span className="inline-flex items-center gap-1" title={t('course.owner')}>
            <User size={13} aria-hidden="true" /> {empName(course.primaryEmployee)}
          </span>
          <span className="inline-flex items-center gap-1" title={t('course.project')}>
            <FolderKanban size={13} aria-hidden="true" /> {course.operationalProject?.name || '-'}
          </span>
          <span className="inline-flex items-center gap-1" title={t('course.period')}>
            <Calendar size={13} aria-hidden="true" /> {fmtDate(course.startDate)} — {fmtDate(course.endDate)}
          </span>
          {elCount > 0 && (
            <span className="inline-flex items-center gap-1" title={t('course.closureElements')}>
              <ClipboardList size={13} aria-hidden="true" /> {t('course.elementsCount', { count: elCount })}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-background px-3 py-2">
        <Link
          href={`/courses/${course.id}`}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-text-main transition hover:border-primary hover:text-primary"
        >
          <FolderOpen size={13} aria-hidden="true" /> {t('course.open')}
        </Link>
        {canEdit && (
          <Link
            href={`/courses/${course.id}/edit`}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-bold text-text-main transition hover:border-primary hover:text-primary"
          >
            <Pencil size={13} aria-hidden="true" /> {t('common.edit')}
          </Link>
        )}

        {canManage && (
          <>
            <button
              onClick={() => onReassign(course.id)}
              disabled={busy === course.id}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-main transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <ArrowLeftRight size={13} aria-hidden="true" /> {t('course.move')}
            </button>
            {course.status === 'CLOSED' && (
              <button
                onClick={() => onArchive(course.id)}
                disabled={busy === course.id}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-text-soft transition hover:bg-background disabled:opacity-50"
              >
                <Archive size={13} aria-hidden="true" /> {t('nav.archive')}
              </button>
            )}
            <button
              onClick={() => onDelete(course.id, course.name)}
              disabled={busy === course.id}
              className="inline-flex items-center gap-1 rounded-lg border border-burgundy/20 bg-white px-2.5 py-1.5 text-[11px] font-bold text-danger transition hover:bg-burgundy/5 disabled:opacity-50"
            >
              <Trash2 size={13} aria-hidden="true" /> {t('common.delete')}
            </button>
          </>
        )}

        {!canManage && canDel && (
          <button
            onClick={() => onDelete(course.id, course.name)}
            disabled={busy === course.id}
            className="inline-flex items-center gap-1 rounded-lg border border-burgundy/20 px-2.5 py-1.5 text-[11px] font-bold text-danger transition hover:bg-burgundy/5 disabled:opacity-50"
          >
            <Trash2 size={13} aria-hidden="true" /> {t('common.delete')}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────
export default function CoursesPage() {
  const router = useRouter();
  const { activeRole, user } = useAuth();
  const { t, locale } = useTranslation();
  const role = normalizeRole(activeRole) || 'EMPLOYEE';

  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }) : '-');

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'ALL', project: '', employee: '', courseType: '', hasAdvance: '', incomplete: '' });
  const [sortBy, setSortBy] = useState('priority');
  const [view, setView] = useState('grid');
  const [page, setPage] = useState(1);
  const PAGE = 12;

  const [reassignModal, setReassignModal] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [selUser, setSelUser] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/courses', { params: { limit: 300 } });
      const d = res.data;
      setCourses(Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const projectOptions = useMemo(() => [...new Set(courses.map((c) => c.operationalProject?.name).filter(Boolean))], [courses]);
  const employeeOptions = useMemo(() => [...new Set(courses.map((c) => empName(c.primaryEmployee)).filter(Boolean))], [courses]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return courses
      .filter((c) => {
        const ms = !q || [c.name, c.code, c.city, c.operationalProject?.name, empName(c.primaryEmployee)].some((v) => v?.toLowerCase().includes(q));
        const mst = filters.status === 'ALL' || c.status === filters.status;
        const mp = !filters.project || c.operationalProject?.name === filters.project;
        const me = !filters.employee || empName(c.primaryEmployee) === filters.employee;
        const mct = !filters.courseType || c.courseType === filters.courseType;
        const mha = !filters.hasAdvance || (filters.hasAdvance === 'yes' ? c.requiresAdvance : !c.requiresAdvance);
        const hasIncomplete = c.closureElements?.some((el) => el.status !== 'APPROVED' && el.status !== 'NOT_APPLICABLE');
        const mic = !filters.incomplete || (filters.incomplete === 'yes' ? hasIncomplete : !hasIncomplete);
        return ms && mst && mp && me && mct && mha && mic;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        const order = { AWAITING_CLOSURE: 0, EXECUTION: 1, PREPARATION: 2, CLOSED: 3, ARCHIVED: 4 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
  }, [courses, filters, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const paginated = filtered.slice((page - 1) * PAGE, page * PAGE);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const counts = useMemo(() => {
    const m = {};
    for (const c of courses) m[c.status] = (m[c.status] || 0) + 1;
    return m;
  }, [courses]);

  const openReassign = async (courseId, courseName) => {
    setSelUser('');
    setReassignModal({ courseId, courseName });
    if (allUsers.length === 0) {
      try {
        const res = await api.get('/users', { params: { limit: 200 } });
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAllUsers(list.filter((u) => u.isActive !== false));
      } catch {
        toast.error(t('course.reassign.loadUsersFailed'));
      }
    }
  };

  const confirmReassign = async () => {
    if (!selUser) {
      toast.error(t('course.reassign.selectEmployee'));
      return;
    }
    setReassigning(true);
    try {
      await api.put(`/courses/${reassignModal.courseId}/reassign`, { primaryEmployeeId: selUser });
      toast.success(t('course.reassign.success'));
      setReassignModal(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('course.reassign.failed'));
    } finally {
      setReassigning(false);
    }
  };

  const openDelete = (courseId, courseName) => setDeleteModal({ courseId, courseName });

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/courses/${deleteModal.courseId}`);
      toast.success(t('course.delete.success'));
      setDeleteModal(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('course.delete.failed'));
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = (id, name) => openDelete(id, name);
  const handleArchive = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/courses/${id}/archive`);
      toast.success(t('course.archiveAction.success'));
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || t('course.archiveAction.failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* ─── رأس الصفحة ─── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <h1 className="text-xl font-extrabold text-primary">{t('course.listTitle')}</h1>
              <p className="mt-0.5 text-xs text-text-soft">{t('course.listSubtitle', { count: courses.length })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => router.push('/archive')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-bold text-text-main hover:bg-background"
              >
                <Archive size={16} aria-hidden="true" /> {t('nav.archive')}
              </button>
              {canCreateCourse(role) && (
                <button
                  onClick={() => router.push('/courses/create')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-dark"
                >
                  <Plus size={16} aria-hidden="true" /> {t('course.newCourse')}
                </button>
              )}
            </div>
          </div>

          {!loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-2.5">
              {STAT_STATUSES.map(
                (s) =>
                  counts[s] > 0 && (
                    <button
                      key={s}
                      onClick={() => setFilters((p) => ({ ...p, status: p.status === s ? 'ALL' : s }))}
                      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition ${
                        filters.status === s ? `${STATUS_CFG[s]?.badge} border-current` : 'border-border bg-background text-text-soft hover:border-primary/40'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${STATUS_CFG[s]?.dot}`} />
                      {statusLabel(t, s)} ({counts[s]})
                    </button>
                  )
              )}
              <span className="ms-auto rounded-xl border border-border bg-background px-2.5 py-1 text-xs text-text-soft">
                {t('course.showing', { shown: filtered.length, total: courses.length })}
              </span>
            </div>
          )}
        </div>

        {/* ─── شريط الفلتر ─── */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
            <input
              value={filters.search}
              onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
              placeholder={t('course.searchPlaceholder')}
              className="w-full rounded-xl border border-border py-2 text-sm outline-none focus:border-primary ps-9 pe-3"
            />
          </div>

          {projectOptions.length > 1 && (
            <select
              value={filters.project}
              onChange={(e) => setFilters((p) => ({ ...p, project: e.target.value }))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">{t('course.allProjects')}</option>
              {projectOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}

          {employeeOptions.length > 1 && (role === 'MANAGER' || role === 'PROJECT_SUPERVISOR') && (
            <select
              value={filters.employee}
              onChange={(e) => setFilters((p) => ({ ...p, employee: e.target.value }))}
              className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">{t('course.allCoordinators')}</option>
              {employeeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}

          {/* فلاتر نوع الدورة */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilters((p) => ({ ...p, courseType: '' }))}
              className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                !filters.courseType ? 'border-primary bg-primary-light text-primary' : 'border-border bg-white text-text-soft hover:border-primary/40'
              }`}
            >
              {t('course.allTypes')}
            </button>
            <button
              onClick={() => setFilters((p) => ({ ...p, courseType: p.courseType === 'internal' ? '' : 'internal' }))}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                filters.courseType === 'internal' ? 'border-primary bg-primary-light text-primary' : 'border-border bg-white text-text-soft hover:border-primary/40'
              }`}
            >
              <Building2 size={13} aria-hidden="true" /> {t('course.typeInternal')}
            </button>
            <button
              onClick={() => setFilters((p) => ({ ...p, courseType: p.courseType === 'external' ? '' : 'external' }))}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                filters.courseType === 'external' ? 'border-primary bg-primary-light text-primary' : 'border-border bg-white text-text-soft hover:border-primary/40'
              }`}
            >
              <Plane size={13} aria-hidden="true" /> {t('course.typeExternal')}
            </button>
          </div>

          {/* فلاتر السلفة والعناصر */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilters((p) => ({ ...p, hasAdvance: p.hasAdvance === 'yes' ? '' : 'yes' }))}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                filters.hasAdvance === 'yes' ? 'border-warning bg-sand/20 text-warning' : 'border-border bg-white text-text-soft hover:border-warning/40'
              }`}
            >
              <Coins size={13} aria-hidden="true" /> {t('course.hasAdvance')}
            </button>
            <button
              onClick={() => setFilters((p) => ({ ...p, incomplete: p.incomplete === 'yes' ? '' : 'yes' }))}
              className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition ${
                filters.incomplete === 'yes' ? 'border-danger bg-burgundy/10 text-danger' : 'border-border bg-white text-text-soft hover:border-danger/40'
              }`}
            >
              <AlertTriangle size={13} aria-hidden="true" /> {t('course.incomplete')}
            </button>
          </div>

          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => setFilters({ search: '', status: 'ALL', project: '', employee: '', courseType: '', hasAdvance: '', incomplete: '' })}
              aria-label={t('common.close')}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}

          <div className="ms-auto flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold text-text-main outline-none focus:border-primary"
            >
              <option value="priority">{t('course.byPriority')}</option>
              <option value="newest">{t('course.newest')}</option>
              <option value="oldest">{t('course.oldest')}</option>
            </select>
            <div className="flex overflow-hidden rounded-xl border border-border">
              <button
                onClick={() => setView('grid')}
                aria-label={t('course.gridView')}
                className={`px-3 py-2 transition ${view === 'grid' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}
              >
                <LayoutGrid size={15} aria-hidden="true" />
              </button>
              <button
                onClick={() => setView('list')}
                aria-label={t('course.listView')}
                className={`px-3 py-2 transition ${view === 'list' ? 'bg-primary text-white' : 'bg-white text-text-soft hover:bg-background'}`}
              >
                <List size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── المحتوى ─── */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <span className="text-sm text-text-soft">{t('course.loading')}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
            <BookOpen size={40} aria-hidden="true" className="mx-auto mb-2 text-text-soft/50" />
            <p className="font-bold text-text-main">{t('course.empty')}</p>
            <p className="mt-1 text-sm text-text-soft">
              {Object.values(filters).some(Boolean) ? t('course.emptyFiltered') : canCreateCourse(role) ? t('course.emptyCreate') : t('course.emptyNone')}
            </p>
            {canCreateCourse(role) && !Object.values(filters).some(Boolean) && (
              <button
                onClick={() => router.push('/courses/create')}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-bold text-white hover:bg-primary-dark"
              >
                <Plus size={16} aria-hidden="true" /> {t('course.addCourse')}
              </button>
            )}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {paginated.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                role={role}
                user={user}
                onDelete={handleDelete}
                onArchive={handleArchive}
                onReassign={(id) => openReassign(id, c.name)}
                busy={busyId}
                t={t}
                fmtDate={fmtDate}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
            <div className="divide-y divide-border">
              {paginated.map((c) => {
                const cfg = STATUS_CFG[c.status] || STATUS_CFG.PREPARATION;
                return (
                  <div key={c.id} className={`flex items-center gap-3 px-4 py-3 transition hover:bg-background ${busyId === c.id ? 'opacity-50' : ''}`}>
                    <span className={`h-8 w-1 shrink-0 rounded-full ${cfg.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>{statusLabel(t, c.status)}</span>
                        <Link href={`/courses/${c.id}`} className="truncate text-sm font-bold text-text-main hover:text-primary">
                          {c.name}
                        </Link>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-text-soft">
                        <span className="inline-flex items-center gap-1">
                          <User size={12} aria-hidden="true" /> {empName(c.primaryEmployee)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <FolderKanban size={12} aria-hidden="true" /> {c.operationalProject?.name || '-'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} aria-hidden="true" /> {fmtDate(c.startDate)} — {fmtDate(c.endDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Link
                        href={`/courses/${c.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold hover:border-primary hover:text-primary"
                      >
                        <FolderOpen size={12} aria-hidden="true" /> {t('course.open')}
                      </Link>
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
              {t('course.pageRange', { from: (page - 1) * PAGE + 1, to: Math.min(page * PAGE, filtered.length), total: filtered.length })}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-background disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="text-xs font-bold text-primary">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold hover:bg-background disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Modal نقل المسؤول ══ */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl" role="dialog" aria-modal="true">
            <div className="border-b border-border px-5 py-4">
              <h2 className="inline-flex items-center gap-1.5 text-base font-extrabold text-primary">
                <ArrowLeftRight size={18} aria-hidden="true" /> {t('course.reassign.title')}
              </h2>
              <p className="mt-0.5 truncate text-xs text-text-soft">{t('course.reassign.courseLabel', { name: reassignModal.courseName })}</p>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-text-main">
                  {t('course.reassign.selectNew')} <span className="text-danger">*</span>
                </label>
                {allUsers.length === 0 ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-text-soft">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t('course.reassign.loadingEmployees')}
                  </div>
                ) : (
                  <select
                    value={selUser}
                    onChange={(e) => setSelUser(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-primary"
                  >
                    <option value="">{t('course.reassign.selectPlaceholder')}</option>
                    {allUsers
                      .filter((u) => u.roles?.includes('EMPLOYEE') || u.roles?.includes('PROJECT_SUPERVISOR'))
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName}
                          {u.operationalProject?.name ? ` — ${u.operationalProject.name}` : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <p className="inline-flex items-start gap-1.5 rounded-xl border border-sand/40 bg-sand/10 px-3 py-2 text-xs text-warning">
                <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" /> {t('course.reassign.warning')}
              </p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button
                onClick={confirmReassign}
                disabled={reassigning || !selUser}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-dark disabled:opacity-50"
              >
                {reassigning ? '...' : (<><Check size={16} aria-hidden="true" /> {t('course.reassign.confirm')}</>)}
              </button>
              <button
                onClick={() => setReassignModal(null)}
                disabled={reassigning}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal تأكيد الحذف ══ */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-white shadow-2xl" role="dialog" aria-modal="true">
            <div className="space-y-3 p-5 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-burgundy/10 text-danger">
                <Trash2 size={26} aria-hidden="true" />
              </div>
              <h2 className="text-base font-extrabold text-text-main">{t('course.delete.title')}</h2>
              <p className="text-sm text-text-soft">{t('course.delete.confirmText', { name: deleteModal.courseName })}</p>
              <p className="rounded-xl border border-burgundy/20 bg-burgundy/5 px-3 py-2 text-xs font-bold text-danger">{t('course.delete.irreversible')}</p>
            </div>
            <div className="flex gap-2 border-t border-border px-5 py-3">
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger py-2.5 text-sm font-bold text-white hover:bg-danger/90 disabled:opacity-50"
              >
                {deleting ? '...' : (<><Trash2 size={16} aria-hidden="true" /> {t('course.delete.confirm')}</>)}
              </button>
              <button
                onClick={() => setDeleteModal(null)}
                disabled={deleting}
                className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text-soft hover:bg-background"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
