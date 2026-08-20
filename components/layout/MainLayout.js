import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import useAuth from '../../context/AuthContext';
import api from '../../lib/axios';
import { useTranslation } from '../../lib/i18n';

const MESSAGE_CACHE_TTL_MS = 30000;

export default function MainLayout({ children, breadcrumb }) {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [newMessagePopup, setNewMessagePopup] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // استرجاع تفضيل طيّ الشريط الجانبي
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === '1');
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('sidebar-collapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const popupStorageKey = useMemo(() => {
    if (!user?.id) return null;
    return `seen-message-popup-${user.id}`;
  }, [user]);

  const messageCacheKey = useMemo(() => {
    if (!user?.id) return null;
    return `latest-message-cache-${user.id}`;
  }, [user]);

  useEffect(() => {
    if (!user?.id || !popupStorageKey || !messageCacheKey || router.pathname === '/messages') return;

    let isCancelled = false;

    const openPopupIfNeeded = (latest) => {
      if (!latest?.id || isCancelled) return;
      const seenIds = JSON.parse(sessionStorage.getItem(popupStorageKey) || '[]');
      if (!seenIds.includes(latest.id)) {
        setNewMessagePopup(latest);
      }
    };

    const checkForNewMessages = async () => {
      try {
        const cachedRaw = sessionStorage.getItem(messageCacheKey);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached.timestamp && Date.now() - cached.timestamp < MESSAGE_CACHE_TTL_MS) {
              openPopupIfNeeded(cached.latest);
              return;
            }
          } catch {
            sessionStorage.removeItem(messageCacheKey);
          }
        }

        const res = await api.get('/messages/inbox');
        const items = res.data || [];
        if (!items.length || isCancelled) return;

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

        sessionStorage.setItem(messageCacheKey, JSON.stringify({ latest, timestamp: Date.now() }));
        openPopupIfNeeded(latest);
      } catch (error) {
        console.error('MainLayout new message popup error - MainLayout.js', error);
      }
    };

    const timer = setTimeout(checkForNewMessages, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [user, popupStorageKey, messageCacheKey, router.pathname]);

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
    ? `${newMessagePopup.sender.firstName || ''} ${newMessagePopup.sender.lastName || ''}`.trim() || newMessagePopup.sender.email || t('messages.userFallback')
    : t('messages.userFallback');

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden font-cairo">
      {/* بقع سائلة متحركة خلف كامل التطبيق */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="animate-blob absolute -top-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl end-[-4rem]" />
        <div className="animate-blob absolute top-1/3 h-72 w-72 rounded-full bg-accent/15 blur-3xl start-[-5rem]" style={{ animationDelay: '4s' }} />
        <div className="animate-blob absolute bottom-[-6rem] left-1/3 h-80 w-80 rounded-full bg-support-blue/10 blur-3xl" style={{ animationDelay: '8s' }} />
      </div>

      <Sidebar collapsed={collapsed} />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header
          onMenuClick={() => setMobileNavOpen(true)}
          onToggleSidebar={toggleSidebar}
          scrolled={scrolled}
          breadcrumb={breadcrumb}
        />

        <main
          className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-transparent"
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 8)}
        >
          <div key={router.pathname} className="min-h-full w-full max-w-full animate-fade-in p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>

      {newMessagePopup && (
        <div className="animate-fade-in fixed inset-0 z-[70] flex items-center justify-center bg-primary-dark/40 px-3 py-4 backdrop-blur-sm sm:px-4">
          <div className="animate-pop-in w-full max-w-md overflow-hidden rounded-3xl border border-white/50 bg-white/85 p-4 shadow-deep backdrop-blur-xl sm:p-6">
            <div className="mb-4">
              <h3 className="text-xl font-extrabold text-primary">{t('messages.newMessage')}</h3>
              <p className="mt-2 text-sm leading-7 text-text-soft">
                {t('messages.newMessageFrom')} <span className="font-bold text-text-main">{senderName}</span>
              </p>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-background p-4">
              <div className="mb-2 break-words text-sm font-bold leading-7 text-text-main">
                {newMessagePopup.subject || t('messages.noSubject')}
              </div>
              <div className="line-clamp-4 break-words text-sm leading-8 text-text-soft">
                {newMessagePopup.body || t('messages.noContent')}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={rememberPopupMessage}
                className="w-full rounded-2xl border border-border bg-white px-5 py-3 font-bold text-text-main transition hover:bg-background sm:w-auto"
              >
                {t('messages.later')}
              </button>

              <button
                onClick={openMessagePage}
                className="w-full rounded-2xl bg-primary px-5 py-3 font-bold text-white transition hover:bg-primary-dark sm:w-auto"
              >
                {t('messages.viewMessage')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
