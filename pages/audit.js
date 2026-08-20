import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  FolderArchive,
  RefreshCw,
  Lock,
  Upload,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
  Timer,
  BarChart3,
  StickyNote,
  ClipboardList,
  Pin,
  Search,
  X,
} from 'lucide-react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import { useTranslation } from '../lib/i18n';

// أيقونات/أنماط الأحداث — التسميات من admin.audit.actions.*
const ACTION_META = {
  COURSE_CREATED:             { Icon: Plus,          cls: 'bg-primary-light text-primary border-primary/20' },
  COURSE_UPDATED:             { Icon: Pencil,        cls: 'bg-primary-light text-primary border-primary/10' },
  COURSE_DELETED:             { Icon: Trash2,        cls: 'bg-burgundy/10 text-danger border-burgundy/20' },
  COURSE_ARCHIVED:            { Icon: FolderArchive, cls: 'bg-border/60 text-text-soft border-border' },
  COURSE_REASSIGNED:          { Icon: RefreshCw,     cls: 'bg-sand/20 text-warning border-sand/40' },
  COURSE_CLOSED:              { Icon: Lock,          cls: 'bg-forest-50 text-accent border-accent/20' },
  ELEMENT_SUBMITTED:          { Icon: Upload,        cls: 'bg-primary-light text-primary border-primary/10' },
  ELEMENT_APPROVED:           { Icon: CheckCircle2,  cls: 'bg-forest-50 text-accent border-accent/20' },
  ELEMENT_REJECTED:           { Icon: XCircle,       cls: 'bg-burgundy/10 text-danger border-burgundy/20' },
  ELEMENT_RETURNED:           { Icon: CornerUpLeft,  cls: 'bg-sand/20 text-warning border-sand/40' },
  ELEMENT_EXTENSION_GRANTED:  { Icon: Timer,         cls: 'bg-primary-light text-primary border-primary/10' },
  KPI_SNAPSHOTS_CALCULATED:   { Icon: BarChart3,     cls: 'bg-forest-50 text-primary border-primary/10' },
  KPI_NOTE_ADDED:             { Icon: StickyNote,    cls: 'bg-forest-50 text-accent border-accent/20' },
  ASSIGNMENT_REGISTER_UPDATED:{ Icon: ClipboardList, cls: 'bg-background text-text-soft border-border' },
};

export default function AuditLog() {
  const { t, locale } = useTranslation();
  const intl = locale === 'en' ? 'en-US' : 'ar-SA-u-ca-gregory';

  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ user: '', action: '', course: '' });
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 20;

  const actionLabel = (action) => {
    const lbl = t(`admin.audit.actions.${action}`);
    return lbl === `admin.audit.actions.${action}` ? action : lbl;
  };

  const roleLabel = (role) => {
    if (role === 'SYSTEM') return t('admin.audit.roleSystem');
    const lbl = t(`roles.${role}`);
    return lbl === `roles.${role}` ? role : lbl;
  };

  const fmtRelative = (date) => {
    if (!date) return '-';
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return t('admin.audit.now');
    if (mins < 60)  return t('admin.audit.minutesAgo', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return t('admin.audit.hoursAgo', { count: hrs });
    const days = Math.floor(hrs / 24);
    if (days < 7)   return t('admin.audit.daysAgo', { count: days });
    return new Date(date).toLocaleDateString(intl, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: { limit: 200 } })
      .then((res) => { const d = res.data; setLogs(d?.data || d || []); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const actions = useMemo(() => [...new Set(logs.map((l) => l.action).filter(Boolean))], [logs]);
  const courses = useMemo(() => [...new Set(logs.map((l) => l.course?.name).filter(Boolean))], [logs]);

  const filtered = useMemo(() => {
    const uq = filters.user.trim().toLowerCase();
    return logs.filter((l) => {
      const name = `${l.user?.firstName} ${l.user?.lastName}`.trim().toLowerCase();
      return (!uq || name.includes(uq))
        && (!filters.action || l.action === filters.action)
        && (!filters.course || l.course?.name === filters.course);
    });
  }, [logs, filters]);

  useEffect(() => { setPage(1); }, [filters]);

  const current    = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div>
            <h1 className="text-xl font-extrabold text-primary">{t('admin.audit.title')}</h1>
            <p className="mt-0.5 text-xs text-text-soft">{t('admin.audit.subtitle')}</p>
          </div>
          <span className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-text-main">
            {t('admin.audit.recordCount', { count: filtered.length })}
          </span>
        </div>

        {/* فلاتر */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <div className="relative min-w-[140px] flex-1">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
            <input value={filters.user}
              onChange={(e) => setFilters(p => ({...p, user: e.target.value}))}
              placeholder={t('admin.audit.searchUserPlaceholder')}
              className="w-full rounded-xl border border-border py-2 text-sm outline-none focus:border-primary ps-9 pe-3" />
          </div>
          <select value={filters.action} onChange={(e) => setFilters(p => ({...p, action: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">{t('admin.audit.allActions')}</option>
            {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select>
          <select value={filters.course} onChange={(e) => setFilters(p => ({...p, course: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">{t('admin.audit.allCourses')}</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filters.user || filters.action || filters.course) && (
            <button onClick={() => setFilters({ user:'', action:'', course:'' })}
              aria-label={t('common.close')}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* السجلات */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : current.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-soft">{t('admin.audit.empty')}</div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {current.map((log) => {
                  const meta = ACTION_META[log.action] || { Icon: Pin, cls: 'bg-background text-text-soft border-border' };
                  const ActIcon = meta.Icon;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-background transition">
                      <ActIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-soft" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${meta.cls}`}>{actionLabel(log.action)}</span>
                          <span className="font-bold text-sm text-text-main">
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                          <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-text-soft">
                            {roleLabel(log.roleContext)}
                          </span>
                        </div>
                        {log.course?.name && (
                          <p className="mt-0.5 text-xs text-text-soft">{t('admin.audit.courseLabel')} <span className="font-medium text-text-main">{log.course.name}</span></p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-text-soft" title={new Date(log.createdAt).toLocaleString(intl)}>
                        {fmtRelative(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ترقيم */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-text-soft">{t('admin.audit.pageInfo', { page, total: totalPages, count: filtered.length })}</span>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">{t('common.previous')}</button>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">{t('common.next')}</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
