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

export type PolicyBrand = {
  mode?: "vit_default" | "custom";
  entitled?: boolean;
  displayName?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarStyle?: "colored" | "neutral";
  logoUrl?: string;
  loginBackgroundUrl?: string;
};

export function brandCssVars(brand?: PolicyBrand | null): Record<string, string> {
  if (!brand || brand.mode !== "custom" || !brand.primaryColor) {
    return {};
  }
  const t = buildBrandTokens(brand.primaryColor, brand.accentColor);
  return {
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
  };
}
