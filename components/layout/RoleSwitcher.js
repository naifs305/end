import { useAuth } from '../../context/AuthContext';
import { getAllRoles } from '../../lib/roles';

export default function RoleSwitcher() {
  const { user, activeRole, switchRole } = useAuth();

  if (!user?.roles || user.roles.length < 2) return null;

  const allowedRoles = getAllRoles().filter((role) => user.roles.includes(role.value));

  return (
    <div className="flex min-w-[260px] items-center gap-2 rounded-2xl border border-border bg-white p-2 shadow-sm">
      {allowedRoles.map((role) => (
        <button
          key={role.value}
          onClick={() => switchRole(role.value)}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeRole === role.value
              ? 'bg-primary text-white shadow-soft'
              : 'text-text-soft hover:bg-primary-light hover:text-primary'
          }`}
          title={role.description}
        >
          {role.label}
        </button>
      ))}
    </div>
  );
}
