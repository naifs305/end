import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/audit').then((res) => setLogs(res.data));
  }, []);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <h1 className="text-2xl font-extrabold text-primary">سجل المراجعة</h1>
          <p className="mt-1 text-sm text-text-soft">
            تتبع العمليات والإجراءات المنفذة داخل المنصة
          </p>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-border bg-white shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-background">
              <tr className="text-right text-text-soft">
                <th className="px-6 py-4 font-bold">التاريخ</th>
                <th className="px-6 py-4 font-bold">المستخدم</th>
                <th className="px-6 py-4 font-bold">الحدث</th>
                <th className="px-6 py-4 font-bold">الدورة</th>
                <th className="px-6 py-4 font-bold">السياق</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-text-soft">
                    لا توجد سجلات
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-t border-border transition hover:bg-background">
                    <td className="px-6 py-4 whitespace-nowrap text-text-soft">
                      {new Date(log.createdAt).toLocaleString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-bold text-text-main">
                      {log.user?.firstName} {log.user?.lastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-text-main">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-text-soft">
                      {log.course?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-bold text-primary">
                        {log.roleContext}
                      </span>
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