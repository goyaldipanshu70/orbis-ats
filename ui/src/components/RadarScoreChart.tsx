import { motion } from 'framer-motion';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface RadarScoreData {
  category: string;
  score: number;
  maxScore: number;
}

interface RadarScoreChartProps {
  data: RadarScoreData[];
  size?: number;
}

export function RadarScoreChart({ data, size = 300 }: RadarScoreChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height: size }}
      >
        No data available
      </div>
    );
  }

  const maxDomain = Math.max(...data.map((d) => d.maxScore), 10);

  // Format category labels for display (snake_case -> Title Case)
  const formatted = data.map((d) => ({
    ...d,
    label: d.category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
    <ResponsiveContainer width="100%" height={size}>
      <RadarChart data={formatted} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#64748b' }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, maxDomain]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickCount={5}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            fontSize: 12,
          }}
          formatter={(value: number, _name: string, props: any) => [
            `${value} / ${props.payload.maxScore}`,
            'Score',
          ]}
        />
      </RadarChart>
    </ResponsiveContainer>
    </motion.div>
  );
}
