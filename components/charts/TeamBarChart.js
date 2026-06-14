import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList
} from 'recharts';

const scoreColor = (v) => {
  if (v >= 80) return '#5D8A70';
  if (v >= 60) return '#C3B39F';
  return '#633646';
};

export default function TeamBarChart({ data = [] }) {
  if (!data.length) return (
    <div className="flex h-full items-center justify-center text-sm text-text-soft">لا توجد بيانات — احتسب المؤشرات أولاً</div>
  );

  const sorted = [...data].sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, sorted.length * 42)}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F0F0EE" />
        <XAxis type="number" domain={[0, 100]} tick={{ fontFamily: 'Cairo, sans-serif', fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontFamily: 'Cairo, sans-serif', fontSize: 11, fill: '#2F3437' }}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'الدرجة']}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12, borderRadius: 12, border: '1px solid #D8DDDA' }}
        />
        <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
          {sorted.map((entry) => (
            <Cell key={entry.name} fill={scoreColor(entry.score)} />
          ))}
          <LabelList
            dataKey="score"
            position="right"
            formatter={(v) => `${Number(v).toFixed(0)}%`}
            style={{ fontFamily: 'Cairo, sans-serif', fontSize: 11, fontWeight: 700, fill: '#2F3437' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
