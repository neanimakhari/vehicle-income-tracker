/** Mirror of api brand.util buildBrandTokens — keep in sync for Mock Studio. */

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
    primary400: mixHex(primary, "#ffffff", 0.25),
    primary500: primary,
    primary600: mixHex(primary, "#000000", 0.12),
    primary700: mixHex(primary, "#000000", 0.28),
    primary800: mixHex(primary, "#000000", 0.42),
  };
}

export type BrandDraft = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  sidebarStyle?: "colored" | "neutral";
  logoPath?: string | null;
  logoUrl?: string | null;
};

export const VIT_PRIMARY = "#0d9488";
export const VIT_ACCENT = "#134e4a";
