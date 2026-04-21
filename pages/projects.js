import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../context/AuthContext';
import api from '../lib/axios';
import { canManageProjects } from '../lib/roles';

export default function ProjectsPage() {
  const router = useRouter();
  const { user, activeRole, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !canManageProjects(activeRole))) {
      router.replace('/');
    }
  }, [authLoading, user, activeRole, router]);

  useEffect(() => {
    if (user && canManageProjects(activeRole)) loadData();
  }, [user, activeRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, usersRes] = await Promise.all([
        api.get('/projects'),
        api.get('/users'),
      ]);
      setProjects(projectsRes.data || []);
      setUsers(usersRes.data || []);
    } catch (error) {
      toast.error('تعذر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!projectName.trim()) return toast.error('اسم المشروع مطلوب');
    try {
      await api.post('/projects', { name: projectName });
      setProjectName('');
      toast.success('تم إنشاء المشروع');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر إنشاء المشروع');
    }
  };

  const assignSupervisor = async () => {
    if (!selectedProjectId || !selectedUserId) return toast.error('اختر المشروع والمستخدم');
    try {
      await api.post('/supervisors/assign', {
        userId: selectedUserId,
        operationalProjectId: selectedProjectId,
      });
      setSelectedProjectId('');
      setSelectedUserId('');
      toast.success('تم تعيين المشرف');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر تعيين المشرف');
    }
  };

  const removeSupervisor = async (userId) => {
    try {
      await api.delete(`/supervisors/${userId}`);
      toast.success('تمت إزالة الإشراف');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر إزالة الإشراف');
    }
  };

  const deleteProject = async (id) => {
    try {
      await api.delete(`/projects/${id}`);
      toast.success('تم حذف المشروع');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر حذف المشروع');
    }
  };

  return (
    <MainLayout title="المشاريع التشغيلية">
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">المشاريع التشغيلية</h1>
          <p className="mt-1 text-sm text-text-soft">إدارة المشاريع وتعيين مشرف مشروع واحد لكل مشروع</p>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">إنشاء مشروع</h2>
          <div className="flex gap-3">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
              placeholder="اسم المشروع"
            />
            <button onClick={createProject} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">إنشاء</button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">تعيين مشرف مشروع</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">اختر المشروع</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">اختر المستخدم</option>
              {users.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.firstName} {item.lastName} - {item.email}</option>)}
            </select>
            <button onClick={assignSupervisor} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white">تعيين</button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="mb-3 text-sm font-extrabold text-text-main">المشاريع الحالية</h2>
          {loading ? (
            <div className="py-8 text-center text-text-soft">جاري التحميل...</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <div key={project.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="font-extrabold text-text-main">{project.name}</div>
                  <div className="mt-2 space-y-1 text-xs text-text-soft">
                    <div>المستخدمون: {project._count?.users || 0}</div>
                    <div>الدورات: {project._count?.courses || 0}</div>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-2 text-xs font-bold text-text-soft">المشرفون</div>
                    {!project.supervisors?.length ? (
                      <div className="text-xs text-text-soft">لا يوجد</div>
                    ) : project.supervisors.map((item) => (
                      <div key={item.id} className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span>{item.user.firstName} {item.user.lastName}</span>
                        <button onClick={() => removeSupervisor(item.user.id)} className="text-red-600 hover:underline">إزالة</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => deleteProject(project.id)} className="mt-3 w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600">
                    حذف المشروع
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
