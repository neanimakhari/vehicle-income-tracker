export function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** Relative luminance 0–1 (sRGB). */
export function hexLuminance(hex: string): number {
  const h = hex.replace("#", "").trim();
  if (h.length < 6) return 0;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLin(parseInt(h.slice(0, 2), 16));
  const g = toLin(parseInt(h.slice(2, 4), 16));
  const b = toLin(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Color that stays readable on dark zinc sidebars.
 * Dark brand accents (e.g. Nei-M #1e293b) otherwise become invisible.
 */
export function readableOnDark(
  hex: string | null | undefined,
  fallback = "#a1a1aa",
): string {
  if (!hex || !/^#?[0-9a-fA-F]{6}$/.test(hex.trim())) return fallback;
  const normalized = hex.startsWith("#") ? hex : `#${hex}`;
  // Need enough luminance vs ~zinc-900 (#18181b, ~0.01)
  if (hexLuminance(normalized) < 0.35) {
    return mixHex(normalized, "#ffffff", 0.72);
  }
  return normalized.toLowerCase();
}

/** Keep in sync with api brand.util + system-admin brand-tokens. */
export function buildBrandTokens(primaryHex: string, accentHex?: string | null) {
  const primary = primaryHex.toLowerCase();
  const accent = (accentHex ?? mixHex(primary, "#000000", 0.35)).toLowerCase();
  return {
    primary,
    accent,
    accentOnDark: readableOnDark(accent),
    primary50: mixHex(primary, "#ffffff", 0.92),
    primary100: mixHex(primary, "#ffffff", 0.8),
    primary200: mixHex(primary, "#ffffff", 0.6),
    primary300: mixHex(primary, "#ffffff", 0.4),
    primary400: mixHex(primary, "#ffffff", 0.25),
    primary500: mixHex(primary, "#ffffff", 0.08),
    primary600: primary,
    primary700: mixHex(primary, "#000000", 0.12),
    primary800: mixHex(primary, "#000000", 0.28),
    primary900: mixHex(primary, "#000000", 0.42),
    primary950: mixHex(primary, "#000000", 0.65),
  };
}

export type PolicyBrand = {
  mode?: "vit_default" | "custom";
  entitled?: boolean;
  displayName?: string;
  primaryColor?: string;
  accentColor?: string;
  primaryDarkColor?: string;
  sidebarStyle?: "colored" | "neutral";
  fontFamily?: "inter" | "source_sans_3" | "nunito" | "roboto" | "system";
  borderRadius?: "sm" | "md" | "lg";
  density?: "comfortable" | "compact";
  logoUrl?: string;
  loginBackgroundUrl?: string;
};

export const FONT_CSS: Record<NonNullable<PolicyBrand["fontFamily"]>, string> = {
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  source_sans_3: "var(--font-source-sans), ui-sans-serif, sans-serif",
  nunito: "var(--font-nunito), ui-sans-serif, sans-serif",
  roboto: "var(--font-roboto), ui-sans-serif, sans-serif",
  system: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

export const RADIUS_PX: Record<NonNullable<PolicyBrand["borderRadius"]>, string> = {
  sm: "0.5rem",
  md: "0.75rem",
  lg: "1.25rem",
};

export function brandCssVars(brand?: PolicyBrand | null): Record<string, string> {
  if (!brand || brand.mode !== "custom" || !brand.primaryColor) {
    return {};
  }
  const t = buildBrandTokens(brand.primaryColor, brand.accentColor);
  const font = brand.fontFamily || "inter";
  const radius = brand.borderRadius || "md";
  const density = brand.density || "comfortable";
  const vars: Record<string, string> = {
    "--teal-50": t.primary50,
    "--teal-100": t.primary100,
    "--teal-200": t.primary200,
    "--teal-300": t.primary300,
    "--teal-400": t.primary400,
    "--teal-500": t.primary500,
    "--teal-600": t.primary600,
    "--teal-700": t.primary700,
    "--teal-800": t.primary800,
    "--teal-900": t.primary900,
    "--teal-950": t.primary950,
    "--brand-accent": t.accent,
    "--brand-on-dark": t.accentOnDark,
    "--brand-font": FONT_CSS[font],
    "--brand-radius": RADIUS_PX[radius],
    "--brand-density-pad": density === "compact" ? "0.5rem" : "1rem",
    "--brand-sidebar-style": brand.sidebarStyle === "neutral" ? "neutral" : "colored",
  };
  if (brand.primaryDarkColor) {
    vars["--brand-primary-dark"] = brand.primaryDarkColor;
  }
  return vars;
}

export function brandCssText(brand?: PolicyBrand | null): string {
  const vars = brandCssVars(brand);
  if (!Object.keys(vars).length) return "";
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${body}}body{font-family:var(--brand-font,var(--font-sans),ui-sans-serif,system-ui,sans-serif)}.rounded-brand{border-radius:var(--brand-radius,0.75rem)}`;
}
