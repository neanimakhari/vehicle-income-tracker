/**
 * Entitlement checks are fail-closed:
 * - missing / null / non-array (policy load failure) ⇒ not entitled
 * - empty array ⇒ not entitled for gated modules
 * - successful API always returns a string[] (legacy tenants get all active modules)
 */
export function hasModule(
  entitlements: string[] | null | undefined,
  moduleKey: string,
): boolean {
  if (!Array.isArray(entitlements)) return false;
  return entitlements.includes(moduleKey);
}

export function entitlementList(
  policy: { entitlements?: string[]; featureFlags?: string[] } | null | undefined,
): string[] {
  const raw = policy?.entitlements ?? policy?.featureFlags;
  return Array.isArray(raw) ? raw : [];
}
