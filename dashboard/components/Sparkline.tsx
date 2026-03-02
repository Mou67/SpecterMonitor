"use client";

interface SparklineProps {
  data: number[];
  color: string;
  height?: number;
  maxValue?: number;
}

export default function Sparkline({
  data,
  color,
  height = 24,
  maxValue = 100,
}: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ height }} />;
  }

  const width = 120;
  const padding = 1;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - (Math.min(val, maxValue) / maxValue) * effectiveHeight;
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${padding + effectiveWidth},${height - padding}`,
  ].join(" ");

  const linePoints = points.join(" ");
  const gradientId = `spark-grad-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
