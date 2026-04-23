export default function KPICard({ title, value, color = 'primary' }) {
  const colors = {
    primary: 'text-primary',
    red: 'text-danger',
    yellow: 'text-warning',
  };

  const borders = {
    primary: 'border-primary',
    red: 'border-danger',
    yellow: 'border-warning',
  };

  const backgrounds = {
    primary: 'bg-primary-light/40',
    red: 'bg-red-50',
    yellow: 'bg-amber-50',
  };

  const isLongText = typeof value === 'string' && value.length > 12;

  return (
    <div
      className={`rounded-2xl border border-border border-r-4 ${borders[color]} bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-soft">{title}</p>
          <h3 className={`${isLongText ? 'text-lg leading-7' : 'text-3xl'} break-words font-extrabold ${colors[color]}`}>
            {value}
          </h3>
        </div>

        <div className={`rounded-xl px-3 py-2 ${backgrounds[color]}`}>
          <div className={`text-sm font-bold ${colors[color]}`}>KPI</div>
        </div>
      </div>
    </div>
  );
}
