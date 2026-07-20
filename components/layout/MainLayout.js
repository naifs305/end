import Sidebar from './Sidebar';
import Header from './Header';
import MobileNav from './MobileNav';
import FloatingChat from './FloatingChat';
import { useState } from 'react';

export default function MainLayout({ children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background font-cairo">
      <Sidebar />
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          <div className="min-h-full w-full max-w-full p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>

      <FloatingChat />
    </div>
  );
}
