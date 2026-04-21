import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { key: 'EMPLOYEE', label: 'موظف' },
  { key: 'PROJECT_SUPERVISOR', label: 'مشرف مشروع' },
  { key: 'MANAGER', label: 'مدير' },
  { key: 'QUALITY_VIEWER', label: 'جودة' },
];

export default function EditUser() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get(`/users/${id}`).then((res) => setUser(res.data));
    api.get('/projects').then((res) => setProjects(res.data || []));
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/users/${id}`, {
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        isActive: user.isActive,
        operationalProjectId: user.operationalProjectId,
      });
      toast.success('تم تحديث بيانات المستخدم');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const newPass = prompt('أدخل كلمة المرور الجديدة:');
    if (newPass) {
      try {
        await api.put(`/users/${id}/reset-password`, { password: newPass });
        toast.success('تم تغيير كلمة المرور');
      } catch (e) {
        toast.error('فشل التغيير');
      }
    }
  };

  const toggleRole = (roleKey, checked) => {
    const roles = checked
      ? [...new Set([...(user.roles || []), roleKey])]
      : (user.roles || []).filter((r) => r !== roleKey);
    setUser({ ...user, roles });
  };

  const inputClass = 'w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10';

  if (!user) {
    return <MainLayout><div className="rounded-3xl border border-border bg-white p-6 text-text-soft shadow-card">جاري التحميل...</div></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <h1 className="text-2xl font-extrabold text-primary">تعديل المستخدم</h1>
          <p className="mt-2 text-sm text-text-soft">{user.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-bold text-text-main">الاسم الأول</label>
              <input className={inputClass} value={user.firstName || ''} onChange={(e) => setUser({ ...user, firstName: e.target.value })} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-bold text-text-main">الاسم الأخير</label>
              <input className={inputClass} value={user.lastName || ''} onChange={(e) => setUser({ ...user, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-text-main">المشروع التشغيلي</label>
            <select className={inputClass} value={user.operationalProjectId || ''} onChange={(e) => setUser({ ...user, operationalProjectId: e.target.value })}>
              <option value="">اختر المشروع</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-text-main">الحالة</label>
            <select className={inputClass} value={user.isActive ? 'true' : 'false'} onChange={(e) => setUser({ ...user, isActive: e.target.value === 'true' })}>
              <option value="true">فعال</option>
              <option value="false">معطل</option>
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm font-bold text-text-main">الأدوار</label>
            <div className="flex flex-wrap gap-4">
              {ROLE_OPTIONS.map((role) => (
                <label key={role.key} className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-medium text-text-main">
                  <input
                    type="checkbox"
                    checked={(user.roles || []).includes(role.key)}
                    onChange={(e) => toggleRole(role.key, e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-text-soft">المدير فقط هو من يمنح الأدوار للمستخدمين. دور الجودة مخصص لعرض تقارير الافتتاح والاختتام والطباعة فقط.</p>
          </div>

          <div className="flex flex-col gap-3 pt-2 md:flex-row">
            <button type="submit" disabled={loading} className="flex-1 rounded-2xl bg-primary py-3 font-bold text-white transition hover:bg-primary-dark disabled:opacity-60">
              {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
            <button type="button" onClick={handleReset} className="flex-1 rounded-2xl border border-border bg-white py-3 font-bold text-text-main transition hover:bg-background">
              تغيير كلمة المرور
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
