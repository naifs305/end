import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import MainLayout from '../components/layout/MainLayout';
import { useRouter } from 'next/router';
import { canManageProjects } from '../lib/roles';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [candidateUsers, setCandidateUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newProjectName, setNewProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (!authLoading && user && !canManageProjects(activeRole)) {
      toast.error('لا تملك صلاحية الوصول لهذه الصفحة');
      router.push('/');
    }
  }, [user, activeRole, authLoading, router]);

  useEffect(() => {
    if (user && canManageProjects(activeRole)) {
      loadData();
    }
  }, [user, activeRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, supervisorsRes, usersRes] = await Promise.all([
        api.get('/projects'),
        api.get('/supervisors'),
        api.get('/users'),
      ]);
      setProjects(projectsRes.data);
      setSupervisors(supervisorsRes.data);
      setCandidateUsers(usersRes.data || []);
    } catch (err) {
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) {
      toast.error('أدخل اسم المشروع');
      return;
    }
    setCreating(true);
    try {
      await api.post('/projects', { name: newProjectName });
      toast.success('تم إنشاء المشروع');
      setNewProjectName('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الإنشاء');
    } finally {
      setCreating(false);
    }
  };

  const assignSupervisor = async () => {
    if (!selectedProjectId || !selectedUserId) {
      toast.error('اختر المشروع والموظف');
      return;
    }
    try {
      await api.post('/supervisors/assign', {
        userId: selectedUserId,
        operationalProjectId: selectedProjectId,
      });
      toast.success('تم تعيين المشرف');
      setSelectedProjectId('');
      setSelectedUserId('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في التعيين');
    }
  };

  const unassignSupervisor = async (userId) => {
    if (!confirm('هل أنت متأكد من إزالة الإشراف؟')) return;
    try {
      await api.delete(`/supervisors/${userId}`);
      toast.success('تمت إزالة الإشراف');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الإزالة');
    }
  };

  const deleteProject = async (id, name) => {
    if (!confirm(`هل تريد حذف المشروع "${name}"؟`)) return;
    try {
      await api.delete(`/projects/${id}`);
      toast.success('تم الحذف');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'لا يمكن الحذف');
    }
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="py-20 text-center text-text-soft">جاري التحميل...</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4">
        <header>
          <h1 className="text-2xl font-extrabold text-primary">المشاريع التشغيلية</h1>
          <p className="mt-1 text-sm text-text-soft">
            إدارة المشاريع التشغيلية وتعيين مشرفيها
          </p>
        </header>

        {/* إنشاء مشروع جديد */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">إنشاء مشروع جديد</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="اسم المشروع التشغيلي"
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <button
              onClick={createProject}
              disabled={creating}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-dark disabled:opacity-60"
            >
              {creating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
          </div>
        </section>

        {/* قائمة المشاريع */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">
            المشاريع الحالية ({projects.length})
          </h2>
          {projects.length === 0 ? (
            <div className="py-6 text-center text-sm text-text-soft">
              لا توجد مشاريع بعد
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <h3 className="text-sm font-extrabold text-text-main">{p.name}</h3>
                  <div className="mt-2 space-y-1 text-xs text-text-soft">
                    <div>الموظفون: {p._count?.users ?? 0}</div>
                    <div>الدورات: {p._count?.courses ?? 0}</div>
                    <div>المشرفون: {p.supervisors?.length ?? 0}</div>
                  </div>
                  {p.supervisors && p.supervisors.length > 0 && (
                    <div className="mt-3 border-t border-border pt-2">
                      <div className="text-xs font-bold text-text-soft">المشرفون:</div>
                      {p.supervisors.map((s) => (
                        <div key={s.id} className="mt-1 flex items-center justify-between">
                          <span className="text-xs">
                            {s.user.firstName} {s.user.lastName}
                          </span>
                          <button
                            onClick={() => unassignSupervisor(s.user.id)}
                            className="text-xs text-danger hover:underline"
                          >
                            إزالة
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => deleteProject(p.id, p.name)}
                    className="mt-3 w-full rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/5"
                  >
                    حذف المشروع
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* تعيين مشرف */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">تعيين مشرف مشروع</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">اختر المشروع</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">اختر الموظف</option>
              {candidateUsers
                .filter((u) => u.isActive)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} — {u.email}
                  </option>
                ))}
            </select>
            <button
              onClick={assignSupervisor}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-dark"
            >
              تعيين كمشرف
            </button>
          </div>
          <p className="mt-2 text-xs text-text-soft">
            * ملاحظة: الموظف المعيّن سيحصل تلقائياً على دور «مشرف المشروع» بالإضافة لأدواره الحالية.
            مشرف واحد فقط لكل شخص.
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
