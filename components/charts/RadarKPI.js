import { memo } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip
} from 'recharts';
import { useTranslation } from '../../lib/i18n';

function RadarKPI({ data = [] }) {
  const { t } = useTranslation();

  if (!data.length) return (
    <div className="flex h-full items-center justify-center text-sm text-text-soft">{t('common.noData')}</div>
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#D8DDDA" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontFamily: 'Cairo, sans-serif', fontSize: 11, fill: '#6E767A' }}
        />
        <Radar
          name={t('charts.performance')}
          dataKey="score"
          stroke="#253C32"
          fill="#5D8A70"
          fillOpacity={0.22}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, t('charts.score')]}
          contentStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12, borderRadius: 12, border: '1px solid #D8DDDA' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export default memo(RadarKPI);
