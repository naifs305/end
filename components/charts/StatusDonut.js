import { memo } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslation } from '../../lib/i18n';

// لوحة ألوان ثابتة بالترتيب: قيد الإعداد، قيد التنفيذ، بانتظار الإغلاق، مغلقة، مؤرشفة
const PALETTE = ['#9DA3A1', '#253C32', '#C3B39F', '#5D8A70', '#633646'];

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Cairo, sans-serif' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

function StatusDonut({ data = [] }) {
  const { t } = useTranslation();

  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return (
    <div className="flex h-full items-center justify-center text-sm text-text-soft">{t('common.noData')}</div>
  );

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={filtered}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          labelLine={false}
          label={renderCustomLabel}
        >
          {filtered.map((entry, i) => (
            <Cell key={entry.name} fill={entry.fill || PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [t('charts.coursesCount', { count: value }), name]}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12, borderRadius: 12, border: '1px solid #D8DDDA' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontFamily: 'Cairo, sans-serif', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export default memo(StatusDonut);
