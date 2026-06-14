import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = {
  'قيد الإعداد':     '#9DA3A1',
  'قيد التنفيذ':     '#253C32',
  'بانتظار الإغلاق': '#C3B39F',
  'مغلقة':           '#5D8A70',
  'مؤرشفة':          '#633646',
};

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

export default function StatusDonut({ data = [] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (!filtered.length) return (
    <div className="flex h-full items-center justify-center text-sm text-text-soft">لا توجد بيانات</div>
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
          {filtered.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] || '#94a3b8'} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [`${value} دورة`, name]}
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
