"use client";

/** Read live brand teal scale from CSS vars (falls back to VIT teal). */
export function getBrandChartColors(): string[] {
  if (typeof window === "undefined") {
    return ["#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#042f2e"];
  }
  const style = getComputedStyle(document.documentElement);
  const keys = [
    "--teal-400",
    "--teal-500",
    "--teal-600",
    "--teal-700",
    "--teal-800",
    "--teal-900",
    "--teal-950",
    "--teal-300",
  ];
  const colors = keys
    .map((k) => style.getPropertyValue(k).trim())
    .filter((c) => /^#[0-9A-Fa-f]{6}$/i.test(c));
  return colors.length >= 4
    ? colors
    : ["#14b8a6", "#0d9488", "#0f766e", "#115e59", "#134e4a", "#042f2e"];
}

export function getBrandPrimary(): string {
  return getBrandChartColors()[2] ?? "#0d9488";
}
