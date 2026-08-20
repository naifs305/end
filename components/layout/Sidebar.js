import Image from 'next/image';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../lib/i18n';
import { buildNavSections } from './navConfig';
import NavLink from './NavLink';

export default function Sidebar({ collapsed = false }) {
  const router = useRouter();
  const { activeRole } = useAuth();
  const { t } = useTranslation();

  const sections = buildNavSections(activeRole, t);
  const active = (href) => router.pathname === href || (href !== '/' && router.pathname.startsWith(href));

  return (
    <aside
      className={`hidden flex-col border-e border-white/40 bg-white/70 shadow-card backdrop-blur-xl transition-all duration-300 md:flex ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      {/* الشعار */}
      <div className="flex h-[76px] items-center justify-center border-b border-white/40 bg-white/40 px-4">
        <div
          className={`relative transition-all duration-300 ${
            collapsed ? 'h-12 w-12 overflow-hidden rounded-xl shadow-sm' : 'h-12 w-full max-w-[190px]'
          }`}
        >
          <Image
            src={collapsed ? '/channels4_profile.jpg' : 'https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg'}
            alt={t('common.university')}
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>

      {/* القائمة */}
      <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden py-3 ${collapsed ? 'px-2' : 'px-3'}`}>
        {sections.map((sec) => (
          <div key={sec.title} className="animate-fade-in">
            {collapsed ? (
              <div className="mx-2 my-2 border-t border-border/60" aria-hidden="true" />
            ) : (
              <p className="flex items-center gap-2 px-2 pt-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-text-soft/70">
                <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
                {sec.title}
              </p>
            )}
            {sec.items.map(({ href, icon, label }) => (
              <NavLink key={href} href={href} icon={icon} label={label} active={active(href)} collapsed={collapsed} />
            ))}
          </div>
        ))}
      </nav>

      {/* حقوق النشر */}
      {!collapsed && (
        <div className="border-t border-white/40 bg-white/30 px-4 py-3 text-center">
          <p className="text-[10px] font-bold text-text-soft/70">{t('common.footerOrg')}</p>
          <p className="text-[10px] text-text-soft/40">{t('common.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      )}
    </aside>
  );
}
