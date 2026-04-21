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

  return (
    <div
      className={`rounded-2xl border border-border border-r-4 ${borders[color]} bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-soft">
            {title}
          </p>
          <h3 className={`text-3xl font-extrabold ${colors[color]}`}>{value}</h3>
        </div>

        <div className={`rounded-xl px-3 py-2 ${backgrounds[color]}`}>
          <div className={`text-sm font-bold ${colors[color]}`}>KPI</div>
        </div>
      </div>
    </div>
  );
}