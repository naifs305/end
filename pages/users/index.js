import { useState, useEffect, useMemo } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import Link from 'next/link';

const ROLE_CFG = {
  MANAGER:            { label: 'مدير',            cls: 'bg-purple-100 text-purple-700' },
  PROJECT_SUPERVISOR: { label: 'مشرف مشروع',      cls: 'bg-blue-100 text-blue-700' },
  EMPLOYEE:           { label: 'منسق',             cls: 'bg-slate-100 text-slate-700' },
  QUALITY_VIEWER:     { label: 'جودة',             cls: 'bg-amber-100 text-amber-700' },
};

export default function UserManagement() {
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
            <h1 className="text-xl font-extrabold text-primary">إدارة المستخدمين</h1>
            <p className="mt-0.5 text-xs text-text-soft">جميع المديرين والمشرفين والمنسقين في النظام</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              ['المجموع', stats.total, 'text-primary'],
              ['نشطون', stats.active, 'text-success'],
              ['مديرون', stats.managers, 'text-purple-700'],
              ['مشرفون', stats.supervisors, 'text-blue-700'],
              ['منسقون', stats.employees, 'text-slate-600'],
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
          <input value={filters.search}
            onChange={(e) => setFilters(p => ({...p, search: e.target.value}))}
            placeholder="🔍 اسم أو بريد..."
            className="min-w-[180px] flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
          <select value={filters.role} onChange={(e) => setFilters(p => ({...p, role: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">كل الأدوار</option>
            <option value="MANAGER">مدير</option>
            <option value="PROJECT_SUPERVISOR">مشرف مشروع</option>
            <option value="EMPLOYEE">منسق</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters(p => ({...p, status: e.target.value}))}
            className="rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary">
            <option value="">الكل</option>
            <option value="active">نشط فقط</option>
            <option value="inactive">معطل فقط</option>
          </select>
        </div>

        {/* القائمة */}
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-text-soft">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm">جاري التحميل...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-soft">لا توجد نتائج</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 transition">
                  {/* أفاتار */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${u.isActive ? 'bg-primary' : 'bg-slate-300'}`}>
                    {u.firstName?.[0]}{u.lastName?.[0]}
                  </div>

                  {/* معلومات */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-text-main">{u.firstName} {u.lastName}</span>
                      {(u.roles || []).map(r => (
                        <span key={r} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_CFG[r]?.cls || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_CFG[r]?.label || r}
                        </span>
                      ))}
                      {!u.isActive && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-500">معطل</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-text-soft">
                      <span>{u.email}</span>
                      {u.operationalProject?.name && <span>• {u.operationalProject.name}</span>}
                      {u.mobileNumber && <span>• {u.mobileNumber}</span>}
                    </div>
                  </div>

                  <Link href={`/users/${u.id}`}
                    className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary-light">
                    تعديل
                  </Link>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-border px-4 py-2 text-xs text-text-soft">
            عرض {filtered.length} من {users.length} مستخدم
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
