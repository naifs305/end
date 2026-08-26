import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Search, Pencil, UserPlus } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';

const ROLE_OPTIONS = ['EMPLOYEE', 'PROJECT_SUPERVISOR', 'MANAGER', 'QUALITY_VIEWER'];

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

  // إضافة موظف عبر البحث في Active Directory
  const [projects, setProjects] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [adQuery, setAdQuery] = useState('');
  const [adResults, setAdResults] = useState([]);
  const [adLoading, setAdLoading] = useState(false);
  const [adSearched, setAdSearched] = useState(false);
  const [picked, setPicked] = useState(null);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newExtension, setNewExtension] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newRoles, setNewRoles] = useState(['EMPLOYEE']);
  const [saving, setSaving] = useState(false);

  function loadUsers() {
    setLoading(true);
    return api.get('/users').then((res) => { const d = res.data; setUsers(Array.isArray(d) ? d : d?.data || []); })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    api.get('/projects').then((res) => setProjects(res.data || [])).catch(() => setProjects([]));
  }, []);

  // بحث AD مع تأخير بسيط حتى لا نستعلم مع كل حرف
  useEffect(() => {
    const q = adQuery.trim();
    if (!addOpen || q.length < 2) { setAdResults([]); setAdSearched(false); return; }
    setAdLoading(true);
    const timer = setTimeout(() => {
      api.get(`/admin/ad-search?q=${encodeURIComponent(q)}`)
        .then((res) => { setAdResults(res.data?.results || []); })
        .catch((err) => {
          setAdResults([]);
          toast.error(err.response?.data?.message || t('admin.users.directorySearchFailed'));
        })
        .finally(() => { setAdSearched(true); setAdLoading(false); });
    }, 400);
    return () => { clearTimeout(timer); setAdLoading(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adQuery, addOpen]);

  function resetAddForm() {
    setAddOpen(false); setAdQuery(''); setAdResults([]); setAdSearched(false);
    setPicked(null); setNewFirstName(''); setNewLastName('');
    setNewMobile(''); setNewExtension(''); setNewProjectId(''); setNewRoles(['EMPLOYEE']);
  }

  function pickEntry(entry) {
    setPicked(entry);
    setNewFirstName(entry.firstName || '');
    setNewLastName(entry.lastName || '');
    setNewMobile(entry.mobile || '');
    setNewExtension(entry.extension || '');
  }

  function toggleNewRole(role) {
    setNewRoles((prev) => {
      const next = prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role];
      return next.length ? next : prev;
    });
  }

  async function addEmployee() {
    if (!picked || saving) return;
    if (!newProjectId) { toast.error(t('admin.users.addEmployeeProjectLabel')); return; }
    setSaving(true);
    try {
      await api.post('/users', {
        email: picked.email,
        firstName: newFirstName.trim() || picked.username,
        lastName: newLastName.trim() || picked.username,
        mobileNumber: newMobile,
        extensionNumber: newExtension || null,
        operationalProjectId: newProjectId,
        roles: newRoles,
      });
      resetAddForm();
      await loadUsers();
      toast.success(t('admin.users.employeeAdded'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.users.addEmployeeFailed'));
    } finally {
      setSaving(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
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
            {!addOpen && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary-dark"
              >
                <UserPlus size={14} aria-hidden="true" />
                {t('admin.users.addEmployeeButton')}
              </button>
            )}
          </div>
        </div>

        {/* إضافة موظف عبر Active Directory */}
        {addOpen && (
          <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
            <h3 className="text-sm font-extrabold text-text-main">{t('admin.users.addEmployeeHeading')}</h3>
            <p className="mt-1 text-xs text-text-soft">{t('admin.users.addEmployeeHint')}</p>

            <input
              className="mt-3 w-full max-w-md rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder={t('admin.users.directorySearchPlaceholder')}
              value={adQuery}
              onChange={(e) => { setAdQuery(e.target.value); setPicked(null); }}
              autoFocus
            />

            <div className="mt-3">
              {adLoading && <p className="text-xs text-text-soft">{t('admin.users.directorySearching')}</p>}

              {!adLoading && adSearched && adResults.length === 0 && (
                <p className="text-xs text-text-soft">{t('admin.users.directoryNoResults')}</p>
              )}

              {!adLoading && adResults.length > 0 && (
                <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                  {adResults.map((entry) => (
                    <label
                      key={entry.username}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 ${entry.alreadyAdded ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'} ${picked?.username === entry.username ? 'bg-primary-light' : 'hover:bg-white'}`}
                    >
                      <input
                        type="radio"
                        name="ad-pick"
                        disabled={entry.alreadyAdded}
                        checked={picked?.username === entry.username}
                        onChange={() => pickEntry(entry)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-text-main">{entry.displayName || entry.username}</span>
                        <span className="block text-xs text-text-soft">{entry.email}</span>
                      </span>
                      {entry.alreadyAdded && (
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-text-soft">
                          {t('admin.users.directoryAlreadyAdded')}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {picked && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-text-main">{t('admin.users.firstName')}</label>
                  <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-text-main">{t('admin.users.lastName')}</label>
                  <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-text-main">{t('admin.users.addEmployeeMobileLabel')}</label>
                  <input value={newMobile} onChange={(e) => setNewMobile(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-text-main">{t('admin.users.addEmployeeExtensionLabel')}</label>
                  <input value={newExtension} onChange={(e) => setNewExtension(e.target.value)}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-bold text-text-main">{t('admin.users.addEmployeeProjectLabel')}</label>
                  <select value={newProjectId} onChange={(e) => setNewProjectId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                    <option value="" disabled>{t('admin.users.selectProject')}</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-text-main">{t('admin.users.addEmployeeRolesLabel')}</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((role) => {
                      const checked = newRoles.includes(role);
                      return (
                        <label key={role} className="flex cursor-pointer select-none items-center gap-1.5">
                          <input type="checkbox" checked={checked} onChange={() => toggleNewRole(role)} className="h-3.5 w-3.5 rounded" />
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${checked ? ROLE_CLS[role] : 'bg-background text-text-soft border border-border'}`}>
                            {t(`roles.${role}`)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {picked && (
                <button type="button" onClick={addEmployee} disabled={saving}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70">
                  {saving ? t('admin.users.addEmployeeSaving') : t('admin.users.addEmployeeSubmit')}
                </button>
              )}
              <button type="button" onClick={resetAddForm} disabled={saving}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-text-soft transition hover:bg-background">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

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
                      {u.isDirectoryAccount && (
                        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-text-soft" title={t('admin.users.directoryAccountTooltip')}>
                          {t('admin.users.directoryBadge')}
                        </span>
                      )}
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
