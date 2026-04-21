import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Header from './Header';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';

export default function MainLayout({ children }) {
  const router = useRouter();
  const { user } = useAuth();

  const [newMessagePopup, setNewMessagePopup] = useState(null);

  const popupStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `seen-message-popup-${user.id}`;
  }, [user]);

  useEffect(() => {
    if (!user?.id || !popupStorageKey) return;

    const checkForNewMessages = async () => {
      try {
        const res = await api.get('/messages/inbox');
        const items = res.data || [];

        if (!items.length) return;

        const latest = items
          .map((item) => ({
            id: item.message?.id,
            subject: item.message?.subject || '',
            body: item.message?.body || '',
            createdAt: item.message?.createdAt || null,
            sender: item.message?.sender || null,
          }))
          .filter((item) => item.id && item.createdAt)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

        if (!latest?.id) return;

        const seenIds = JSON.parse(sessionStorage.getItem(popupStorageKey) || '[]');

        if (!seenIds.includes(latest.id)) {
          setNewMessagePopup(latest);
        }
      } catch (error) {
        console.error('MainLayout new message popup error - MainLayout.js:48', error);
      }
    };

    checkForNewMessages();

    const interval = setInterval(checkForNewMessages, 10000);
    return () => clearInterval(interval);
  }, [user, popupStorageKey]);

  const rememberPopupMessage = () => {
    if (!newMessagePopup?.id || !popupStorageKey) {
      setNewMessagePopup(null);
      return;
    }

    const seenIds = JSON.parse(sessionStorage.getItem(popupStorageKey) || '[]');
    const updated = Array.from(new Set([...seenIds, newMessagePopup.id]));
    sessionStorage.setItem(popupStorageKey, JSON.stringify(updated));
    setNewMessagePopup(null);
  };

  const openMessagePage = () => {
    rememberPopupMessage();
    router.push('/messages');
  };

  const senderName = newMessagePopup?.sender
    ? `${newMessagePopup.sender.firstName || ''} ${newMessagePopup.sender.lastName || ''}`.trim() ||
      newMessagePopup.sender.email ||
      'مستخدم'
    : 'مستخدم';

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background font-cairo">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header />

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          <div className="min-h-full w-full max-w-full p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>

      {newMessagePopup && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#2F3437]/40 px-3 py-4 backdrop-blur-sm sm:px-4">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.18)] sm:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-primary">رسالة جديدة</h3>
              <p className="mt-2 text-sm leading-7 text-text-soft">
                لديك رسالة جديدة من: <span className="font-bold text-text-main">{senderName}</span>
              </p>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-background p-4">
              <div className="mb-2 break-words text-sm font-bold leading-7 text-text-main">
                {newMessagePopup.subject || 'بدون عنوان'}
              </div>
              <div className="line-clamp-4 break-words text-sm leading-8 text-text-soft">
                {newMessagePopup.body || 'لا يوجد محتوى'}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={rememberPopupMessage}
                className="w-full rounded-2xl border border-border bg-white px-5 py-3 font-bold text-text-main transition hover:bg-background sm:w-auto"
              >
                لاحقًا
              </button>

              <button
                onClick={openMessagePage}
                className="w-full rounded-2xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-dark sm:w-auto"
              >
                عرض الرسالة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}