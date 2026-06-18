import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../lib/i18n';

export default function RoleSwitcher() {
  const { user, activeRole, switchRole } = useAuth();
  const { t } = useTranslation();

  if (!user || !user.roles || user.roles.length < 2) return null;

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-background p-1 shadow-sm">
      {user.roles.map((role) => (
        <button
          key={role}
          onClick={() => switchRole(role)}
          aria-pressed={activeRole === role}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
            activeRole === role
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-soft hover:bg-primary-light hover:text-primary'
          }`}
        >
          {t(`roles.${role}`)}
        </button>
      ))}
    </div>
  );
}
