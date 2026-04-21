import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import { translateRoles } from '../../lib/roles';

export default function UsersIndexPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (error) {
      toast.error('تعذر تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout title="المستخدمون">
      <div className="space-y-6 p-4">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">المستخدمون</h1>
          <p className="mt-1 text-sm text-text-soft">عرض المستخدمين وفق نطاق صلاحيتك الحالي</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-background">
              <tr className="text-right text-text-soft">
                <th className="px-4 py-3">الاسم</th>
                <th className="px-4 py-3">البريد</th>
                <th className="px-4 py-3">المشروع</th>
                <th className="px-4 py-3">الأدوار</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-text-soft">جاري التحميل...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-text-soft">لا يوجد مستخدمون</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-4 py-3 font-bold text-text-main">{user.firstName} {user.lastName}</td>
                    <td className="px-4 py-3 text-text-soft">{user.email}</td>
                    <td className="px-4 py-3 text-text-soft">{user.operationalProject?.name || '-'}</td>
                    <td className="px-4 py-3 text-text-soft">{translateRoles(user.roles)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-1 text-xs font-bold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {user.isActive ? 'فعال' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/users/${user.id}`} className="text-primary hover:underline">فتح</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
