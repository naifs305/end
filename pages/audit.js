import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

const ACTION_MAP = {
  COURSE_CREATED:             { label: 'إنشاء دورة',          cls: 'bg-primary-light text-primary border-primary/20',      icon: '➕' },
  COURSE_UPDATED:             { label: 'تعديل دورة',           cls: 'bg-primary-light text-primary border-primary/10',      icon: '✏️' },
  COURSE_DELETED:             { label: 'حذف دورة',             cls: 'bg-burgundy/10 text-danger border-burgundy/20',        icon: '🗑️' },
  COURSE_ARCHIVED:            { label: 'أرشفة دورة',           cls: 'bg-border/60 text-text-soft border-border',            icon: '📁' },
  COURSE_REASSIGNED:          { label: 'إعادة إسناد دورة',     cls: 'bg-sand/20 text-warning border-sand/40',              icon: '🔄' },
  COURSE_CLOSED:              { label: 'إقفال دورة',           cls: 'bg-forest-50 text-accent border-accent/20',           icon: '🔒' },
  ELEMENT_SUBMITTED:          { label: 'تقديم عنصر',           cls: 'bg-primary-light text-primary border-primary/10',      icon: '📤' },
  ELEMENT_APPROVED:           { label: 'اعتماد عنصر',          cls: 'bg-forest-50 text-accent border-accent/20',           icon: '✅' },
  ELEMENT_REJECTED:           { label: 'رفض عنصر',             cls: 'bg-burgundy/10 text-danger border-burgundy/20',        icon: '❌' },
  ELEMENT_RETURNED:           { label: 'إعادة عنصر',           cls: 'bg-sand/20 text-warning border-sand/40',              icon: '↩️' },
  ELEMENT_EXTENSION_GRANTED:  { label: 'تمديد موعد',           cls: 'bg-primary-light text-primary border-primary/10',      icon: '⏱️' },
  KPI_SNAPSHOTS_CALCULATED:   { label: 'احتساب مؤشرات الأداء', cls: 'bg-forest-50 text-primary border-primary/10',          icon: '📊' },
  KPI_NOTE_ADDED:             { label: 'ملاحظة أداء',          cls: 'bg-forest-50 text-accent border-accent/20',           icon: '📝' },
  ASSIGNMENT_REGISTER_UPDATED:{ label: 'تحديث سجل الإسناد',    cls: 'bg-background text-text-soft border-border',          icon: '📋' },
};

function fmtRelative(date) {
  if (!date) return '-';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'الآن';
  if (mins < 60)  return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `منذ ${days} يوم`;
  return new Date(date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

const ROLE_LABEL = { MANAGER: 'مدير', PROJECT_SUPERVISOR: 'مشرف', EMPLOYEE: 'موظف', SYSTEM: 'نظام' };

export default function AuditLog() {
  const [logs, setLogs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ user: '', action: '', course: '' });
  const [page, setPage]         = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/audit', { params: { limit: 200 } })
      .then((res) => { const d = res.data; setLogs(d?.data || d || []); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const users   = useMemo(() => [...new Set(logs.map((l) => `${l.user?.firstName} ${l.user?.lastName}`.trim()).filter(Boolean))], [logs]);
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
            <h1 className="text-xl font-extrabold text-primary">سجل المراجعة</h1>
            <p className="mt-0.5 text-xs text-text-soft">تتبع كامل لجميع العمليات والإجراءات داخل المنصة</p>
          </div>
          <span className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold text-text-main">
            {filtered.length} سجل
          </span>
        </div>

        {/* فلاتر */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <input value={filters.user}
            onChange={(e) => setFilters(p => ({...p, user: e.target.value}))}
            placeholder="🔍 اسم المستخدم..."
            className="min-w-[140px] flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={filters.action} onChange={(e) => setFilters(p => ({...p, action: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الأحداث</option>
            {actions.map((a) => <option key={a} value={a}>{ACTION_MAP[a]?.label || a}</option>)}
          </select>
          <select value={filters.course} onChange={(e) => setFilters(p => ({...p, course: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الدورات</option>
            {courses.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(filters.user || filters.action || filters.course) && (
            <button onClick={() => setFilters({ user:'', action:'', course:'' })}
              className="rounded-xl border border-border px-3 py-2 text-sm text-text-soft hover:bg-background">✕</button>
          )}
        </div>

        {/* السجلات */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">جاري التحميل...</span>
            </div>
          ) : current.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-soft">لا توجد سجلات تطابق الفلتر</div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {current.map((log) => {
                  const act = ACTION_MAP[log.action] || { label: log.action, cls: 'bg-background text-text-soft border-border', icon: '📌' };
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-background transition">
                      <span className="mt-0.5 text-lg">{act.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${act.cls}`}>{act.label}</span>
                          <span className="font-bold text-sm text-text-main">
                            {log.user?.firstName} {log.user?.lastName}
                          </span>
                          <span className="rounded-full bg-background border border-border px-2 py-0.5 text-[10px] text-text-soft">
                            {ROLE_LABEL[log.roleContext] || log.roleContext}
                          </span>
                        </div>
                        {log.course?.name && (
                          <p className="mt-0.5 text-xs text-text-soft">الدورة: <span className="font-medium text-text-main">{log.course.name}</span></p>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-text-soft" title={new Date(log.createdAt).toLocaleString('ar-SA')}>
                        {fmtRelative(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ترقيم */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <span className="text-xs text-text-soft">صفحة {page} من {totalPages} ({filtered.length} سجل)</span>
                  <div className="flex gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p-1)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">السابق</button>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p+1)}
                      className="rounded-xl border border-border px-3 py-1.5 text-xs font-bold disabled:opacity-40 hover:bg-background">التالي</button>
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
