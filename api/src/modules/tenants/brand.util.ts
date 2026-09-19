import { BadRequestException } from '@nestjs/common';

export const VIT_PRIMARY = '#0d9488';
export const VIT_ACCENT = '#134e4a';
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export type BrandPayload = {
  displayName?: string | null;
  primaryHex?: string | null;
  accentHex?: string | null;
  sidebarStyle?: 'colored' | 'neutral';
  logoPath?: string | null;
  logoMime?: string | null;
  loginBgPath?: string | null;
  loginBgMime?: string | null;
};

export type BrandPolicyDto = {
  mode: 'vit_default' | 'custom';
  entitled: boolean;
  displayName?: string;
  primaryColor?: string;
  accentColor?: string;
  sidebarStyle?: 'colored' | 'neutral';
  logoUrl?: string;
  loginBackgroundUrl?: string;
};

/** Letterhead for tenant emails/PDFs when white-label is live. */
export type BrandLetterhead = {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  logoUrl?: string;
};

export function letterheadFromPolicy(
  policy: BrandPolicyDto,
  fallbackName: string,
): BrandLetterhead {
  if (policy.mode === 'custom' && policy.entitled && policy.primaryColor) {
    return {
      displayName: policy.displayName || fallbackName,
      primaryColor: policy.primaryColor,
      accentColor: policy.accentColor || mixHex(policy.primaryColor, '#000000', 0.35),
      logoUrl: policy.logoUrl,
    };
  }
  return {
    displayName: fallbackName,
    primaryColor: VIT_PRIMARY,
    accentColor: VIT_ACCENT,
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
}): { primaryHex: string | null; accentHex: string | null } {
  const primaryHex = normalizeHex(input.primaryHex);
  const accentHex = normalizeHex(input.accentHex);
  if (primaryHex) assertPrimaryContrast(primaryHex);
  return { primaryHex, accentHex };
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

/** Build CSS-oriented scale from a primary seed (shared with admin mocks). */
export function buildBrandTokens(primaryHex: string, accentHex?: string | null) {
  const primary = primaryHex.toLowerCase();
  const accent = (accentHex ?? mixHex(primary, '#000000', 0.35)).toLowerCase();
  return {
    primary,
    accent,
    primary400: mixHex(primary, '#ffffff', 0.25),
    primary500: primary,
    primary600: mixHex(primary, '#000000', 0.12),
    primary700: mixHex(primary, '#000000', 0.28),
    primary800: mixHex(primary, '#000000', 0.42),
  };
}

export function brandFieldsFromTenant(tenant: {
  brandDisplayName: string | null;
  brandPrimaryHex: string | null;
  brandAccentHex: string | null;
  brandSidebarStyle: string;
  brandLogoPath: string | null;
  brandLogoMime: string | null;
  brandLoginBgPath: string | null;
  brandLoginBgMime: string | null;
}): BrandPayload {
  return {
    displayName: tenant.brandDisplayName,
    primaryHex: tenant.brandPrimaryHex,
    accentHex: tenant.brandAccentHex,
    sidebarStyle:
      tenant.brandSidebarStyle === 'neutral' ? 'neutral' : 'colored',
    logoPath: tenant.brandLogoPath,
    logoMime: tenant.brandLogoMime,
    loginBgPath: tenant.brandLoginBgPath,
    loginBgMime: tenant.brandLoginBgMime,
  };
}
