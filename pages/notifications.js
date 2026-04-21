import { useState, useEffect } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    api.get('/notifications').then((res) => setNotifications(res.data));
  }, []);

  const handleRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-card">
          <h1 className="text-2xl font-extrabold text-primary">التنبيهات</h1>
          <p className="mt-1 text-sm text-text-soft">مركز الإشعارات والتنبيهات التشغيلية</p>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-3xl border border-border bg-white p-8 text-center text-text-soft shadow-card">
              لا توجد تنبيهات حاليًا
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleRead(n.id)}
                className={`cursor-pointer rounded-3xl border p-5 shadow-card transition hover:shadow-soft ${
                  n.isRead
                    ? 'border-border bg-white'
                    : 'border-primary/20 bg-primary-light/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      n.type === 'ESCALATION'
                        ? 'bg-red-50 text-danger'
                        : 'bg-[#fcf8f1] text-[#8c6b2a]'
                    }`}
                  >
                    {n.type === 'ESCALATION' ? 'تصعيد' : 'تنبيه'}
                  </span>

                  <span className="text-xs text-text-soft">
                    {new Date(n.createdAt).toLocaleString('ar-SA')}
                  </span>
                </div>

                <h4 className="mt-3 text-base font-extrabold text-text-main">{n.title}</h4>
                <p className="mt-2 text-sm leading-7 text-text-soft">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}