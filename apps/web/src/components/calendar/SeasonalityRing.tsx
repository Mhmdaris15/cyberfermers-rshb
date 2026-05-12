import { motion } from "framer-motion";

// 12-month wheel. The wedge containing today is highlighted; passing a `focus`
// month index (0..11) highlights it instead. Lightweight, no external libs.
interface SeasonalityRingProps {
  size?: number;
  focus?: number;
  labels?: string[];
}

export function SeasonalityRing({ size = 280, focus, labels }: SeasonalityRingProps) {
  const today = focus ?? new Date().getMonth();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const innerR = r - 30;
  const wedge = (i: number) => {
    const start = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const end = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(start) * r;
    const y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    const xi1 = cx + Math.cos(end) * innerR;
    const yi1 = cy + Math.sin(end) * innerR;
    const xi2 = cx + Math.cos(start) * innerR;
    const yi2 = cy + Math.sin(start) * innerR;
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 0 0 ${xi2} ${yi2} Z`;
  };

  const months = labels ?? [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="select-none">
      <defs>
        <radialGradient id="ring-bg" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="hsl(var(--bg-elevated))" stopOpacity="0.0" />
          <stop offset="100%" stopColor="hsl(var(--leaf))" stopOpacity="0.18" />
        </radialGradient>
        <linearGradient id="active" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--leaf))" />
          <stop offset="1" stopColor="hsl(var(--amber))" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 4} fill="url(#ring-bg)" />
      {Array.from({ length: 12 }).map((_, i) => {
        const isActive = i === today;
        return (
          <motion.path
            key={i}
            d={wedge(i)}
            fill={isActive ? "url(#active)" : "hsl(var(--bg-elevated))"}
            stroke="hsl(var(--line))"
            strokeOpacity={0.6}
            strokeWidth={1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.04 }}
          />
        );
      })}
      {/* labels */}
      {months.map((m, i) => {
        const ang = ((i + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
        const lr = r - 15;
        const x = cx + Math.cos(ang) * lr;
        const y = cy + Math.sin(ang) * lr;
        const isActive = i === today;
        return (
          <text
            key={m}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-mono text-[10px]"
            fill={isActive ? "hsl(var(--bg))" : "hsl(var(--ink-dim))"}
          >
            {m}
          </text>
        );
      })}
      {/* center label */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="font-display text-[11px] uppercase tracking-widest"
        fill="hsl(var(--ink-mute))"
      >
        сезон
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        className="font-display text-2xl font-bold"
        fill="hsl(var(--ink))"
      >
        {months[today]}
      </text>
    </svg>
  );
}
