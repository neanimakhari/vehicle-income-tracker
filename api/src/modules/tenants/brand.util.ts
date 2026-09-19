import { BadRequestException } from '@nestjs/common';

export const VIT_PRIMARY = '#0d9488';
export const VIT_ACCENT = '#134e4a';
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export const BRAND_FONT_FAMILIES = [
  'inter',
  'source_sans_3',
  'nunito',
  'roboto',
  'system',
] as const;
export type BrandFontFamily = (typeof BRAND_FONT_FAMILIES)[number];

export const BRAND_BORDER_RADII = ['sm', 'md', 'lg'] as const;
export type BrandBorderRadius = (typeof BRAND_BORDER_RADII)[number];

export const BRAND_DENSITIES = ['comfortable', 'compact'] as const;
export type BrandDensity = (typeof BRAND_DENSITIES)[number];

export const MAX_BRAND_ASSET_BYTES = 2_000_000;
export const MAX_DISPLAY_NAME_LEN = 80;

export type BrandPayload = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  primaryDarkHex?: string | null;
  sidebarStyle?: 'colored' | 'neutral';
  fontFamily?: BrandFontFamily | null;
  borderRadius?: BrandBorderRadius | null;
  density?: BrandDensity | null;
  /** @deprecated path on disk — prefer logoData */
  logoPath?: string | null;
  logoMime?: string | null;
  logoData?: string | null;
  loginBgPath?: string | null;
  loginBgMime?: string | null;
  loginBgData?: string | null;
};

export type BrandPolicyDto = {
  mode: 'vit_default' | 'custom';
  entitled: boolean;
  displayName?: string;
  primaryColor?: string;
  accentColor?: string;
  primaryDarkColor?: string;
  sidebarStyle?: 'colored' | 'neutral';
  fontFamily?: BrandFontFamily;
  borderRadius?: BrandBorderRadius;
  density?: BrandDensity;
  logoUrl?: string;
  loginBackgroundUrl?: string;
};

/** Letterhead for tenant emails/PDFs when white-label is live. */
export type BrandLetterhead = {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
  fontStack?: string;
};

export const FONT_STACKS: Record<BrandFontFamily, string> = {
  inter: 'Inter, ui-sans-serif, system-ui, sans-serif',
  source_sans_3: '"Source Sans 3", "Source Sans Pro", ui-sans-serif, sans-serif',
  nunito: 'Nunito, ui-sans-serif, sans-serif',
  roboto: 'Roboto, ui-sans-serif, sans-serif',
  system: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};

export const RADIUS_PX: Record<BrandBorderRadius, number> = {
  sm: 8,
  md: 12,
  lg: 20,
};

export function letterheadFromPolicy(
  policy: BrandPolicyDto,
  fallbackName: string,
): BrandLetterhead {
  if (policy.mode === 'custom' && policy.entitled && policy.primaryColor) {
    const font = policy.fontFamily ?? 'inter';
    return {
      displayName: policy.displayName || fallbackName,
      primaryColor: policy.primaryColor,
      accentColor: policy.accentColor || mixHex(policy.primaryColor, '#000000', 0.35),
      logoUrl: policy.logoUrl,
      fontStack: FONT_STACKS[font],
    };
  }
  return {
    displayName: fallbackName,
    primaryColor: VIT_PRIMARY,
    accentColor: VIT_ACCENT,
    fontStack: FONT_STACKS.inter,
  };
}

export function normalizeHex(input: string | null | undefined): string | null {
  if (input == null || input === '') return null;
  const hex = input.trim();
  if (!HEX_RE.test(hex)) {
    throw new BadRequestException('Color must be #RRGGBB');
  }
  return hex.toLowerCase();
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function assertPrimaryContrast(hex: string): void {
  if (relativeLuminance(hex) > 0.85) {
    throw new BadRequestException(
      'Primary color is too light for UI contrast; choose a darker shade',
    );
  }
}

export function validateBrandColors(input: {
  primaryHex?: string | null;
  accentHex?: string | null;
  primaryDarkHex?: string | null;
}): {
  primaryHex: string | null;
  accentHex: string | null;
  primaryDarkHex: string | null;
} {
  const primaryHex = normalizeHex(input.primaryHex);
  const accentHex = normalizeHex(input.accentHex);
  const primaryDarkHex = normalizeHex(input.primaryDarkHex);
  if (primaryHex) assertPrimaryContrast(primaryHex);
  return { primaryHex, accentHex, primaryDarkHex };
}

export function normalizeFontFamily(
  input: string | null | undefined,
): BrandFontFamily | null {
  if (input == null || input === '') return null;
  const v = input.trim().toLowerCase().replace(/-/g, '_');
  if (!(BRAND_FONT_FAMILIES as readonly string[]).includes(v)) {
    throw new BadRequestException(
      `fontFamily must be one of: ${BRAND_FONT_FAMILIES.join(', ')}`,
    );
  }
  return v as BrandFontFamily;
}

export function normalizeBorderRadius(
  input: string | null | undefined,
): BrandBorderRadius | null {
  if (input == null || input === '') return null;
  const v = input.trim().toLowerCase();
  if (!(BRAND_BORDER_RADII as readonly string[]).includes(v)) {
    throw new BadRequestException('borderRadius must be sm, md, or lg');
  }
  return v as BrandBorderRadius;
}

export function normalizeDensity(
  input: string | null | undefined,
): BrandDensity | null {
  if (input == null || input === '') return null;
  const v = input.trim().toLowerCase();
  if (!(BRAND_DENSITIES as readonly string[]).includes(v)) {
    throw new BadRequestException('density must be comfortable or compact');
  }
  return v as BrandDensity;
}

export function normalizeDisplayName(
  input: string | null | undefined,
): string | null {
  if (input == null) return null;
  const t = input.trim();
  if (!t) return null;
  if (t.length > MAX_DISPLAY_NAME_LEN) {
    throw new BadRequestException(
      `Display name must be ${MAX_DISPLAY_NAME_LEN} characters or fewer`,
    );
  }
  return t;
}

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
      .padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/**
 * Full 50–950 scale used by tenant-admin CSS + studio mocks.
 * primary600 === seed (matches Tailwind teal-600 usage).
 */
export function buildBrandTokens(primaryHex: string, accentHex?: string | null) {
  const primary = primaryHex.toLowerCase();
  const accent = (accentHex ?? mixHex(primary, '#000000', 0.35)).toLowerCase();
  return {
    primary,
    accent,
    primary50: mixHex(primary, '#ffffff', 0.92),
    primary100: mixHex(primary, '#ffffff', 0.8),
    primary200: mixHex(primary, '#ffffff', 0.6),
    primary300: mixHex(primary, '#ffffff', 0.4),
    primary400: mixHex(primary, '#ffffff', 0.25),
    primary500: mixHex(primary, '#ffffff', 0.08),
    primary600: primary,
    primary700: mixHex(primary, '#000000', 0.12),
    primary800: mixHex(primary, '#000000', 0.28),
    primary900: mixHex(primary, '#000000', 0.42),
    primary950: mixHex(primary, '#000000', 0.65),
  };
}

export function brandFieldsFromTenant(tenant: {
  brandDisplayName: string | null;
  brandPrimaryHex: string | null;
  brandAccentHex: string | null;
  brandPrimaryDarkHex?: string | null;
  brandSidebarStyle: string;
  brandFontFamily?: string | null;
  brandBorderRadius?: string | null;
  brandDensity?: string | null;
  brandLogoPath: string | null;
  brandLogoMime: string | null;
  brandLogoData?: string | null;
  brandLoginBgPath: string | null;
  brandLoginBgMime: string | null;
  brandLoginBgData?: string | null;
}): BrandPayload {
  return {
    displayName: tenant.brandDisplayName,
    primaryHex: tenant.brandPrimaryHex,
    accentHex: tenant.brandAccentHex,
    primaryDarkHex: tenant.brandPrimaryDarkHex ?? null,
    sidebarStyle:
      tenant.brandSidebarStyle === 'neutral' ? 'neutral' : 'colored',
    fontFamily: (tenant.brandFontFamily as BrandFontFamily) || null,
    borderRadius: (tenant.brandBorderRadius as BrandBorderRadius) || null,
    density: (tenant.brandDensity as BrandDensity) || null,
    logoPath: tenant.brandLogoPath,
    logoMime: tenant.brandLogoMime,
    logoData: tenant.brandLogoData ?? null,
    loginBgPath: tenant.brandLoginBgPath,
    loginBgMime: tenant.brandLoginBgMime,
    loginBgData: tenant.brandLoginBgData ?? null,
  };
}

export function hasLogoAsset(p: {
  logoData?: string | null;
  logoPath?: string | null;
}): boolean {
  return Boolean(p.logoData || p.logoPath);
}

export function hasLoginBgAsset(p: {
  loginBgData?: string | null;
  loginBgPath?: string | null;
}): boolean {
  return Boolean(p.loginBgData || p.loginBgPath);
}
