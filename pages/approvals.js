import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import Link from 'next/link';

export default function ApprovalsQueue() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get('/analytics/approvals-queue').then(res => setItems(res.data));
  }, []);

  return (
    <MainLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">طابور الاعتمادات</h1>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الدورة</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">العنصر</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الموظف</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">تاريخ التقديم</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">إجراء</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.courseName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.elementName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.employeeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(item.submittedAt).toLocaleString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link href={`/courses/${item.courseId}`}>
                        <span className="text-primary hover:underline cursor-pointer font-semibold">مراجعة واعتماد</span>
                      </Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-400">لا توجد عناصر بانتظار الاعتماد حالياً</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}