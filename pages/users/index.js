import { useState, useEffect } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import api from '../../lib/axios';
import Link from 'next/link';

function RoleBadge({ role }) {
  const map = {
    MANAGER: 'bg-purple-100 text-purple-700',
    PROJECT_SUPERVISOR: 'bg-blue-100 text-blue-700',
    EMPLOYEE: 'bg-gray-100 text-gray-700',
    QUALITY_VIEWER: 'bg-amber-100 text-amber-700',
  };

  const labelMap = {
    MANAGER: 'مدير',
    PROJECT_SUPERVISOR: 'مشرف مشروع',
    EMPLOYEE: 'موظف',
    QUALITY_VIEWER: 'جودة',
  };

  return <span className={`px-2 py-1 rounded text-xs font-bold ${map[role] || 'bg-gray-100 text-gray-700'}`}>{labelMap[role] || role}</span>;
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get('/users').then((res) => setUsers(res.data || []));
  }, []);

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">إدارة المستخدمين</h1>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الاسم</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">البريد</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الأدوار</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الحالة</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{user.firstName} {user.lastName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex flex-wrap gap-1">
                      {(user.roles || []).map((role) => <RoleBadge key={role} role={role} />)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${user.isActive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {user.isActive ? 'فعال' : 'معطل'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary hover:underline">
                    <Link href={`/users/${user.id}`}>تعديل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
