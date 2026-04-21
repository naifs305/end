import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ children }) {
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-background font-cairo">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <Header />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-background">
          <div className="min-h-full w-full max-w-full p-3 sm:p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
