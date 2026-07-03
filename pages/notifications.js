import { useState, useEffect, useCallback } from 'react';
import MainLayout from '../components/layout/MainLayout';
import api from '../lib/axios';
import toast from 'react-hot-toast';

const TYPE_META = {
  ESCALATION:           { label: 'تصعيد',         cls: 'bg-burgundy/10 text-danger border-burgundy/20',  icon: '🔴', dot: 'bg-danger' },
  EMPLOYEE_LOW_SCORE:   { label: 'أداء منخفض',    cls: 'bg-burgundy/10 text-danger border-burgundy/20',  icon: '⚠️', dot: 'bg-danger' },
  ELEMENT_RETURNED:     { label: 'عنصر مُعاد',    cls: 'bg-sand/20 text-warning border-sand/40',          icon: '↩️', dot: 'bg-warning' },
  REMINDER:             { label: 'تذكير',          cls: 'bg-primary-light text-primary border-primary/20', icon: '🔔', dot: 'bg-primary' },
  KPI_CALCULATED:       { label: 'KPI جديد',       cls: 'bg-forest-50 text-accent border-accent/20',      icon: '📊', dot: 'bg-accent' },
  DEFAULT:              { label: 'تنبيه',          cls: 'bg-sand/20 text-warning border-sand/40',          icon: '💬', dot: 'bg-warning' },
};

function getMeta(type) {
  return TYPE_META[type] || TYPE_META.DEFAULT;
}

function fmtRelative(v) {
  if (!v) return '—';
  const diff = Date.now() - new Date(v).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1)   return 'الآن';
  if (min < 60)  return `منذ ${min} دقيقة`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24)  return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `منذ ${days} يوم`;
  return new Date(v).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Notifications() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/notifications', { params: { limit: 50 } })
      .then(res => {
        const d = res.data;
        setItems(Array.isArray(d) ? d : (d?.data || []));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    api.post(`/notifications/${id}/read`).catch(() => {});
  };

  const handleMarkAll = async () => {
    const unread = items.filter(n => !n.isRead);
    if (!unread.length) return;
    setMarking(true);
    try {
      await Promise.all(unread.map(n => api.post(`/notifications/${n.id}/read`)));
      setItems(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('تم تحديد الكل كمقروء');
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = items.filter(n => !n.isRead).length;

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl space-y-4">

        {/* رأس */}
        <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-extrabold text-primary">🔔 الإشعارات</h1>
              <p className="mt-0.5 text-xs text-text-soft">
                {loading ? '...' : unreadCount > 0
                  ? `${unreadCount} إشعار غير مقروء`
                  : 'جميع الإشعارات مقروءة'}
              </p>
            </div>
            {!loading && unreadCount > 0 && (
              <button
                onClick={handleMarkAll}
                disabled={marking}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text-main hover:border-primary hover:text-primary disabled:opacity-50 transition">
                {marking
                  ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  : '✓'}
                تحديد الكل كمقروء
              </button>
            )}
          </div>
        </div>

        {/* القائمة */}
        {loading ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-white py-16 shadow-card">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white py-16 text-center shadow-card">
            <p className="text-3xl mb-3">🔔</p>
            <p className="font-bold text-text-main">لا توجد إشعارات</p>
            <p className="mt-1 text-sm text-text-soft">ستظهر هنا التنبيهات والإشعارات التشغيلية</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(n => {
              const meta = getMeta(n.type);
              return (
                <div key={n.id}
                  onClick={() => !n.isRead && handleRead(n.id)}
                  className={`relative overflow-hidden rounded-2xl border shadow-card transition
                    ${n.isRead
                      ? 'border-border bg-white cursor-default'
                      : 'border-primary/20 bg-primary-light/20 cursor-pointer hover:shadow-soft hover:border-primary/30'}`}>

                  {/* خط جانبي للغير مقروء */}
                  {!n.isRead && (
                    <div className={`absolute inset-y-0 end-0 w-1 ${meta.dot}`} />
                  )}

                  <div className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta.icon}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                          {meta.label}
                        </span>
                        {!n.isRead && (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                            جديد
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-soft shrink-0">
                        {fmtRelative(n.createdAt)}
                      </span>
                    </div>

                    <h4 className={`text-sm font-extrabold mb-1 ${n.isRead ? 'text-text-soft' : 'text-text-main'}`}>
                      {n.title}
                    </h4>
                    <p className="text-xs leading-relaxed text-text-soft">{n.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
