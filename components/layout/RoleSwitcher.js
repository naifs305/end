import { useAuth } from '../../context/AuthContext';
import { translateRole } from '../../lib/roles';

export default function RoleSwitcher() {
  const { user, activeRole, switchRole } = useAuth();

  if (!user) return null;
  if (!user.roles || user.roles.length < 2) return null;

  return (
    <div className="flex items-center rounded-full border border-border bg-white p-1 shadow-sm min-w-[280px]">
      {user.roles.map((role) => (
        <button
          key={role}
          onClick={() => switchRole(role)}
          className={`flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${
            activeRole === role
              ? 'bg-primary text-white shadow-soft'
              : 'text-text-soft hover:bg-primary-light hover:text-primary'
          }`}
        >
          {translateRole(role)}
        </button>
      ))}
    </div>
  );
}
