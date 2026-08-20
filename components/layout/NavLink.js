import Link from 'next/link';

/**
 * رابط تنقّل موحّد للشريط الجانبي ودرج الجوال.
 * النشط: خلفية أساسية + شريط ذهبي جانبي. غير النشط: تحويم لطيف.
 * collapsed: وضع الأيقونة فقط (يخفي التسمية ويظهر تلميحاً).
 */
export default function NavLink({ href, icon: Icon, label, active, onClick, collapsed = false }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`group relative flex items-center rounded-xl text-sm font-semibold transition-all duration-200
        ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'}
        ${active ? 'bg-primary text-white shadow-soft' : 'text-text-main hover:bg-primary-light hover:text-primary'}`}
    >
      {/* شريط التمييز الذهبي للعنصر النشط (في الوضع الموسّع فقط) */}
      {active && !collapsed && <span className="absolute inset-y-2 w-1 rounded-full bg-accent start-1" aria-hidden="true" />}
      <Icon
        size={18}
        aria-hidden="true"
        className={`shrink-0 transition-colors ${active ? 'text-white' : 'text-text-soft group-hover:text-primary'}`}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
