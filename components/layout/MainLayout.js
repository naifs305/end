import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import FloatingChat from './FloatingChat';

export default function MainLayout({ children, breadcrumb }) {
  const router = useRouter();
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

      <FloatingChat />
    </div>
  );
}
