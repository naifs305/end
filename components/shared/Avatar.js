// صورة المستخدم الشخصية، وإن لم تكن له صورة فالحرفان الأوّلان من اسمه
export default function Avatar({ user, size = 40, className = '' }) {
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}` || '؟';
  const style = { width: size, height: size };

  if (user?.profileImage) {
    return (
      <img
        src={user.profileImage}
        alt={name ? `صورة ${name}` : 'صورة المستخدم'}
        style={style}
        className={`shrink-0 rounded-full object-cover shadow-[0_0_0_2px_#fff] ${className}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name ? `صورة ${name}` : 'صورة المستخدم'}
      style={{ ...style, fontSize: Math.round(size * 0.36) }}
      className={`grid shrink-0 place-items-center rounded-full bg-forest-50 font-extrabold text-primary shadow-[0_0_0_2px_#fff] ${className}`}
    >
      {initials}
    </span>
  );
}
