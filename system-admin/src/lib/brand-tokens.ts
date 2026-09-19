/** Shared brand token builders — keep in sync with api brand.util + tenant-admin. */

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

/** Full scale; primary600 === seed (matches tenant-admin / Tailwind teal-600). */
export function buildBrandTokens(primaryHex: string, accentHex?: string | null) {
  const primary = primaryHex.toLowerCase();
  const accent = (accentHex ?? mixHex(primary, "#000000", 0.35)).toLowerCase();
  return {
    primary,
    accent,
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

export type BrandFontFamily =
  | "inter"
  | "source_sans_3"
  | "nunito"
  | "roboto"
  | "system";

export type BrandBorderRadius = "sm" | "md" | "lg";
export type BrandDensity = "comfortable" | "compact";

export type BrandDraft = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  primaryDarkHex?: string | null;
  sidebarStyle?: "colored" | "neutral";
  fontFamily?: BrandFontFamily | null;
  borderRadius?: BrandBorderRadius | null;
  density?: BrandDensity | null;
  logoPath?: string | null;
  logoUrl?: string | null;
  loginBackgroundUrl?: string | null;
};

export const VIT_PRIMARY = "#0d9488";
export const VIT_ACCENT = "#134e4a";

export const FONT_OPTIONS: { value: BrandFontFamily; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "source_sans_3", label: "Source Sans 3" },
  { value: "nunito", label: "Nunito" },
  { value: "roboto", label: "Roboto" },
  { value: "system", label: "System UI" },
];

export const RADIUS_OPTIONS: { value: BrandBorderRadius; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

export const DENSITY_OPTIONS: { value: BrandDensity; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

export const RADIUS_PX: Record<BrandBorderRadius, number> = {
  sm: 8,
  md: 12,
  lg: 20,
};
