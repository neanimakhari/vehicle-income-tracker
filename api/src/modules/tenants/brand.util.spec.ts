import {
  assertPrimaryContrast,
  buildBrandTokens,
  normalizeHex,
  relativeLuminance,
  validateBrandColors,
} from './brand.util';

describe('brand.util', () => {
  it('normalizes valid hex', () => {
    expect(normalizeHex('#0D9488')).toBe('#0d9488');
  });

  it('rejects invalid hex', () => {
    expect(() => normalizeHex('teal')).toThrow();
    expect(() => normalizeHex('#fff')).toThrow();
  });

  it('rejects near-white primary', () => {
    expect(() => assertPrimaryContrast('#fefefe')).toThrow();
    expect(relativeLuminance('#0d9488')).toBeLessThan(0.85);
  });

  it('validateBrandColors returns pair', () => {
    expect(
      validateBrandColors({ primaryHex: '#1d4ed8', accentHex: '#1e3a8a' }),
    ).toEqual({ primaryHex: '#1d4ed8', accentHex: '#1e3a8a' });
  });

  it('buildBrandTokens generates scale', () => {
    const t = buildBrandTokens('#0d9488', '#134e4a');
    expect(t.primary500).toBe('#0d9488');
    expect(t.primary600).toMatch(/^#[0-9a-f]{6}$/);
    expect(t.accent).toBe('#134e4a');
  });
});
