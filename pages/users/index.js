import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import Link from 'next/link';
import { Search, Pencil } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

// أنماط الأدوار فقط — التسميات من الترجمة عبر roles.*
const ROLE_CLS = {
  MANAGER: 'bg-primary text-white',
  PROJECT_SUPERVISOR: 'bg-primary-light text-primary border border-primary/20',
  EMPLOYEE: 'bg-background text-text-soft border border-border',
  QUALITY_VIEWER: 'bg-sand/20 text-warning border border-sand/40',
};

export default function UserManagement() {
  const { t } = useTranslation();
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filters, setFilters]   = useState({ search: '', role: '', status: '' });

  useEffect(() => {
    setLoading(true);
    api.get('/users').then((res) => { const d = res.data; setUsers(Array.isArray(d) ? d : d?.data || []); })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return users.filter((u) => {
      const name = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
      return (!q || name.includes(q))
        && (!filters.role   || u.roles?.includes(filters.role))
        && (!filters.status || (filters.status === 'active' ? u.isActive : !u.isActive));
    });
  }, [users, filters]);

  const stats = useMemo(() => ({
    total:       users.length,
    active:      users.filter(u => u.isActive).length,
    managers:    users.filter(u => u.roles?.includes('MANAGER')).length,
    supervisors: users.filter(u => u.roles?.includes('PROJECT_SUPERVISOR')).length,
    employees:   users.filter(u => u.roles?.includes('EMPLOYEE')).length,
  }), [users]);

  return (
    <MainLayout>
      <div className="space-y-4">

        {/* رأس */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div>
            <h1 className="text-xl font-extrabold text-primary">{t('admin.users.title')}</h1>
            <p className="mt-0.5 text-xs text-text-soft">{t('admin.users.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              [t('admin.users.statTotal'),       stats.total,       'text-primary'],
              [t('admin.users.statActive'),      stats.active,      'text-accent'],
              [t('admin.users.statManagers'),    stats.managers,    'text-primary'],
              [t('admin.users.statSupervisors'), stats.supervisors, 'text-primary'],
              [t('admin.users.statEmployees'),   stats.employees,   'text-text-soft'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                <div className={`text-lg font-extrabold ${c}`}>{v}</div>
                <div className="text-text-soft">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* فلاتر */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-white px-4 py-3 shadow-card">
          <div className="relative min-w-[180px] flex-1">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-soft start-3" />
            <input value={filters.search}
              onChange={(e) => setFilters(p => ({...p, search: e.target.value}))}
              placeholder={t('admin.users.searchPlaceholder')}
              className="w-full rounded-xl border border-border py-2 text-sm outline-none focus:border-primary ps-9 pe-3" />
          </div>
          <select value={filters.role} onChange={(e) => setFilters(p => ({...p, role: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">{t('admin.users.allRoles')}</option>
            <option value="MANAGER">{t('roles.MANAGER')}</option>
            <option value="PROJECT_SUPERVISOR">{t('roles.PROJECT_SUPERVISOR')}</option>
            <option value="EMPLOYEE">{t('roles.EMPLOYEE')}</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters(p => ({...p, status: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">{t('admin.users.allStatuses')}</option>
            <option value="active">{t('admin.users.activeOnly')}</option>
            <option value="inactive">{t('admin.users.inactiveOnly')}</option>
          </select>
        </div>

        {/* القائمة */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">{t('common.loading')}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-soft">{t('admin.common.noResults')}</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-background transition">
                  {/* أفاتار */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${u.isActive ? 'bg-primary' : 'bg-text-soft'}`}>
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>

                  {/* معلومات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-text-main">{u.firstName} {u.lastName}</span>
                      {(u.roles || []).map(r => (
                        <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_CLS[r] || 'bg-background text-text-soft border border-border'}`}>
                          {t(`roles.${r}`)}
                        </span>
                      ))}
                      {!u.isActive && <span className="rounded-full bg-burgundy/10 border border-burgundy/20 px-2 py-0.5 text-[10px] font-bold text-danger">{t('admin.users.disabledBadge')}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-text-soft">
                      <span>{u.email}</span>
                      {u.operationalProject?.name && <span>• {u.operationalProject.name}</span>}
                      {u.mobileNumber && <span>• {u.mobileNumber}</span>}
                    </div>
                  </div>

                  <Link href={`/users/${u.id}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-light">
                    <Pencil size={13} aria-hidden="true" /> {t('common.edit')}
                  </Link>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border px-4 py-2 text-xs text-text-soft">
            {t('admin.users.showingCount', { shown: filtered.length, total: users.length })}
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
