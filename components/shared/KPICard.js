import { memo } from 'react';

function KPICard({ title, value, color = 'primary' }) {
  const cfg = {
    primary: { text: 'text-primary',  border: 'border-s-primary',   bg: 'bg-primary-light' },
    red:     { text: 'text-danger',   border: 'border-s-danger',    bg: 'bg-burgundy/5'    },
    yellow:  { text: 'text-warning',  border: 'border-s-warning',   bg: 'bg-sand/10'       },
    green:   { text: 'text-accent',   border: 'border-s-accent',    bg: 'bg-forest-50'     },
  };

  const c = cfg[color] || cfg.primary;
  const isLongText = typeof value === 'string' && value.length > 12;

  return (
    <div className={`rounded-2xl border border-border border-s-4 ${c.border} bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-soft">{title}</p>
          <h3 className={`${isLongText ? 'text-lg leading-7' : 'text-3xl'} break-words font-extrabold ${c.text}`}>
            {value}
          </h3>
        </div>
        <div className={`rounded-xl px-3 py-2 ${c.bg}`}>
          <div className={`text-sm font-bold ${c.text}`}>KPI</div>
        </div>
      </div>
    </div>
  );
}

export default memo(KPICard);
