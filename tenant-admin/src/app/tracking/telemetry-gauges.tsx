"use client";

import type { ReactNode } from "react";

type GaugeProps = {
  label: string;
  value: number;
  min?: number;
  max: number;
  unit?: string;
  warnAt?: number;
  digits?: number;
};

/** Compact SVG semicircle gauge — only render when caller has a real value. */
export function SvgGauge({
  label,
  value,
  min = 0,
  max,
  unit = "",
  warnAt,
  digits = 0,
}: GaugeProps) {
  const clamped = Math.max(min, Math.min(max, value));
  const t = max > min ? (clamped - min) / (max - min) : 0;
  const angle = -90 + t * 180;
  const warn = warnAt != null && value >= warnAt;
  const color = warn ? "#e11d48" : "#0d9488";
  const r = 42;
  const cx = 50;
  const cy = 50;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad(angle));
  const ny = cy + r * Math.sin(rad(angle));

  return (
    <div className="flex flex-col items-center rounded-lg bg-zinc-50 px-2 py-2 dark:bg-zinc-950/60">
      <svg viewBox="0 0 100 62" className="h-16 w-28" aria-hidden>
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-zinc-200 dark:text-zinc-700"
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${nx} ${ny}`}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <circle cx={nx} cy={ny} r="3.5" fill={color} />
      </svg>
      <div
        className={`-mt-1 text-lg font-semibold tabular-nums ${
          warn ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value.toFixed(digits)}
        {unit ? (
          <span className="ml-0.5 text-xs font-medium text-zinc-500">{unit}</span>
        ) : null}
      </div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
    </div>
  );
}

export function TelemetryGauges({
  point,
  hasObd,
}: {
  point: {
    speedKph?: number | null;
    externalVoltage?: number | null;
    engineRpm?: number | null;
    fuelLevelPercent?: number | null;
    coolantC?: number | null;
    overspeed?: boolean | null;
  } | null;
  hasObd: boolean;
}) {
  if (!point) return null;
  const gauges: Array<ReactNode> = [];

  if (point.speedKph != null && Number.isFinite(Number(point.speedKph))) {
    gauges.push(
      <SvgGauge
        key="speed"
        label="Speed"
        value={Number(point.speedKph)}
        max={160}
        unit="km/h"
        warnAt={point.overspeed ? Number(point.speedKph) : 120}
        digits={0}
      />,
    );
  }
  if (
    point.externalVoltage != null &&
    Number.isFinite(Number(point.externalVoltage))
  ) {
    gauges.push(
      <SvgGauge
        key="v"
        label="Voltage"
        value={Number(point.externalVoltage)}
        min={8}
        max={16}
        unit="V"
        warnAt={16}
        digits={1}
      />,
    );
  }
  if (
    hasObd &&
    point.engineRpm != null &&
    Number.isFinite(Number(point.engineRpm))
  ) {
    gauges.push(
      <SvgGauge
        key="rpm"
        label="RPM"
        value={Number(point.engineRpm)}
        max={6000}
        warnAt={4500}
        digits={0}
      />,
    );
  }
  if (
    hasObd &&
    point.fuelLevelPercent != null &&
    Number.isFinite(Number(point.fuelLevelPercent))
  ) {
    gauges.push(
      <SvgGauge
        key="fuel"
        label="Fuel"
        value={Number(point.fuelLevelPercent)}
        max={100}
        unit="%"
        digits={0}
      />,
    );
  }
  if (
    hasObd &&
    point.coolantC != null &&
    Number.isFinite(Number(point.coolantC))
  ) {
    gauges.push(
      <SvgGauge
        key="coolant"
        label="Coolant"
        value={Number(point.coolantC)}
        min={40}
        max={120}
        unit="°C"
        warnAt={100}
        digits={0}
      />,
    );
  }

  if (!gauges.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {gauges}
    </div>
  );
}
