import { useEffect, useMemo, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import Link from 'next/link';
import toast from 'react-hot-toast';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ar-SA');
}

function formatTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

export default function ApprovalsQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/approvals-queue');
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const stats = useMemo(() => ({
    total: items.length,
    oldest: items.length ? formatDate(items[0].submittedAt) : '-',
  }), [items]);

  const handleAction = async (item, status) => {
    const needsReason = status === 'RETURNED' || status === 'REJECTED';
    let notes = '';

    if (needsReason) {
      const promptText = status === 'RETURNED' ? 'سبب إعادة العنصر للموظف:' : 'سبب رفض العنصر:';
      const reason = window.prompt(promptText);
      if (reason === null) return;
      if (!String(reason).trim()) {
        toast.error('السبب مطلوب');
        return;
      }
      notes = String(reason).trim();
    }

    setActingId(item.id);
    try {
      await api.put(`/closure/${item.id}`, { status, notes });
      toast.success(
        status === 'APPROVED'
          ? 'تم اعتماد العنصر'
          : status === 'RETURNED'
          ? 'تمت إعادة العنصر للموظف'
          : 'تم رفض العنصر',
      );
      await fetchQueue();
    } catch (error) {
      toast.error(error.response?.data?.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setActingId('');
    }
  };

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 rounded-3xl border border-border bg-white p-6 shadow-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-text-main">طابور الاعتمادات</h1>
              <p className="mt-2 text-sm text-text-soft">يعرض جميع العناصر التي تحتاج اعتمادًا مباشرًا من الأقدم إلى الأحدث</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-text-main">
                العناصر الحالية: <span className="text-primary">{stats.total}</span>
              </div>
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-bold text-text-main">
                أقدم تقديم: <span className="text-primary">{stats.oldest}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-background">
                <tr className="border-b border-border text-right text-xs font-extrabold text-text-soft">
                  <th className="px-4 py-4">الدورة</th>
                  <th className="px-4 py-4">العنصر</th>
                  <th className="px-4 py-4">الموظف</th>
                  <th className="px-4 py-4">المشرف</th>
                  <th className="px-4 py-4">التاريخ</th>
                  <th className="px-4 py-4">الوقت</th>
                  <th className="px-4 py-4">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-sm text-text-soft">جاري التحميل...</td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-sm text-text-soft">لا توجد عناصر بانتظار الاعتماد حاليًا</td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-primary-light/20">
                      <td className="px-4 py-4 text-sm font-bold text-text-main">
                        <Link href={`/courses/${item.courseId}`} className="hover:text-primary">
                          {item.courseName}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-text-main">{item.elementName}</td>
                      <td className="px-4 py-4 text-sm text-text-main">{item.employeeName}</td>
                      <td className="px-4 py-4 text-sm text-text-main">{item.supervisorName}</td>
                      <td className="px-4 py-4 text-sm text-text-soft">{formatDate(item.submittedAt)}</td>
                      <td className="px-4 py-4 text-sm text-text-soft">{formatTime(item.submittedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAction(item, 'APPROVED')}
                            disabled={actingId === item.id}
                            className="rounded-xl bg-success px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                          >
                            اعتماد
                          </button>
                          <button
                            onClick={() => handleAction(item, 'RETURNED')}
                            disabled={actingId === item.id}
                            className="rounded-xl bg-warning px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                          >
                            إعادة للموظف
                          </button>
                          <button
                            onClick={() => handleAction(item, 'REJECTED')}
                            disabled={actingId === item.id}
                            className="rounded-xl bg-danger px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                          >
                            رفض
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
