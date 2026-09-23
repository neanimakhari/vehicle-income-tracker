"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";

type Point = {
  recordedAt: string;
  speedKph: number | null;
};

export function TrackingSpeedChart({
  points,
  scrubIndex,
  onScrub,
}: {
  points: Point[];
  scrubIndex: number;
  onScrub: (index: number) => void;
}) {
  if (points.length < 2) return null;

  const data = points.map((p, i) => ({
    i,
    t: new Date(p.recordedAt).getTime(),
    label: new Date(p.recordedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    speed: p.speedKph != null ? Number(p.speedKph) : null,
  }));

  const active = data[Math.max(0, Math.min(scrubIndex, data.length - 1))];

  return (
    <div className="h-40 w-full rounded-xl border border-zinc-200/80 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Speed vs time
      </p>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          onClick={(state) => {
            const idx = (state as { activeTooltipIndex?: number | null })
              ?.activeTooltipIndex;
            if (typeof idx === "number") onScrub(idx);
          }}
        >
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            width={32}
            tick={{ fontSize: 10 }}
            unit=""
            domain={[0, "auto"]}
          />
          <Tooltip
            formatter={(v) => [
              v == null ? "—" : `${Number(v).toFixed(0)} km/h`,
              "Speed",
            ]}
            labelFormatter={(_, payload) => {
              const row = payload?.[0]?.payload as { label?: string } | undefined;
              return row?.label ?? "";
            }}
          />
          {active ? (
            <ReferenceLine
              x={active.label}
              stroke="#0d9488"
              strokeDasharray="3 3"
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="speed"
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
