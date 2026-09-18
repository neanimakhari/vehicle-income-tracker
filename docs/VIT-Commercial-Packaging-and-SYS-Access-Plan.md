# VIT Commercial Packaging & SYS Access Plan
**For:** Neani Makhari  
**Product:** Vehicle Income Tracker (VIT)  
**Date:** 17 September 2026  
**Status:** Proposal for review (not implemented)

---

## 1. Goal

Make VIT sellable in **modules** (not only “all or nothing”), managed from **platform admin**, and add **SYS accounts** that can safely enter **any tenant** for support / onboarding / demos — without sharing tenant-admin passwords.

---

## 2. What exists today (baseline)

| Capability | Today |
|------------|--------|
| Multi-tenant | Strong (`platform.tenants` + per-tenant schemas) |
| Platform vs tenant admin | Separate logins; platform **cannot** open tenant UI |
| Feature flags | Column `tenants.feature_flags` exists; **not enforced**, not editable in UI |
| Limits | `maxDrivers` enforced; `maxStorageMb` stored only |
| Billing | Manual usage CSV + TenantBillingModal — **no plans/payments** |
| Impersonation | **None** |

So commercial packaging and SYS access are **new product layers** on top of solid tenancy, not a rewrite.

---

## 3. Product model: sellable parts

### 3.1 Recommended packaging

**Core (included with every paying tenant)**  
Always on: Drivers, Vehicles, Income logging, Expenses, Maintenance basics, Dashboard, MFA/security, Audit trail, Daily targets, Monthly report email.

**Add-on modules (sold / toggled per tenant)**  
Proposed catalog (keys are stable IDs for code + billing):

| Module key | Customer-facing name | Notes |
|------------|----------------------|--------|
| `reports_advanced` | Advanced reports & custom builder | Charts beyond monthly PDF |
| `tracking_live` | Live GPS / trip breadcrumb | Privacy + data cost story |
| `trips` | Trips module | Finish API + UI if selling |
| `scholar_payments` | Scholar payments | Niche; easy upsell |
| `notifications` | Push / in-app notifications | Already partially present |
| `expiry_automation` | Doc expiry automation (SMS/email) | Message costs |
| `dispute_trail` | Owner–driver dispute trail | Trust / SA taxi P0 |
| `cost_per_km` | Cost-per-km / vehicle health | Needs odometer discipline |
| `offline_queue` | Offline-first driver queue | Mobile |
| `webhooks` | Outbound webhooks | For larger fleets / integrators |
| `sla_docs` | SLA document vault | Platform-attached docs |

Start with **5–7 modules** that already have code or clear roadmap; expand catalog later without schema changes if keys stay string-based.

### 3.2 Plans (SKUs)

Platform-defined **plans** that bundle modules + limits:

| Example plan | Includes | Limits |
|--------------|----------|--------|
| **Starter** | Core only | e.g. 5 drivers |
| **Fleet** | Core + advanced reports + expiry automation | e.g. 25 drivers |
| **Pro** | Fleet + tracking + notifications + cost/km | e.g. 100 drivers |
| **Custom** | Pick modules à la carte | Negotiated |

Each tenant gets:
- `planId` (or “Custom”)
- Effective **entitlements** = plan modules ∪ manual overrides
- Limits: `maxDrivers`, optional `maxStorageMb`, later seats/API rate

**Phase 1:** platform assigns plan/modules manually (no payment gateway).  
**Phase 2:** PayFast / Stripe + invoices + renewals (SA-friendly: start PayFast).

### 3.3 Platform-admin UX (selling surface)

On **system-admin → Tenants** (and a new **Catalog / Plans** page):

1. **Module catalog** — name, key, description, default price note (display only in Phase 1).  
2. **Plans** — create/edit plan → checkboxes of modules + default limits.  
3. **Per-tenant entitlements**  
   - Assign plan  
   - Toggle individual modules (override)  
   - Set limits  
   - Optional: trial end date / “grace until”  
4. **Billing aid** — keep usage CSV; show “enabled modules” on tenant card.

Tenant-admin and Flutter **hide** locked nav items; API **rejects** locked routes with `403 FEATURE_NOT_ENTITLED` so clients can’t bypass UI.

---

## 4. Technical design (entitlements)

### 4.1 Data model (platform schema)

```
platform.feature_modules
  id, key (unique), name, description, is_active, sort_order

platform.plans
  id, code, name, description, max_drivers_default, max_storage_mb_default, is_active

platform.plan_modules
  plan_id, module_key

platform.tenant_entitlements
  tenant_id (slug or uuid), plan_id (nullable),
  module_overrides_json  -- { "tracking_live": true/false }
  trial_ends_at, notes
```

Keep existing `tenants.feature_flags` as a **derived cache** updated when entitlements change (fast reads for `/tenant/policy`), or replace reads with entitlement resolver. Prefer **resolver + cache** so one source of truth.

### 4.2 Enforcement

- Nest: `@RequiresModule('tracking_live')` guard on controllers.  
- `GET /tenant/policy` returns `entitlements: string[]` (and limits).  
- tenant-admin: filter `navigation.tsx` by entitlements.  
- Flutter: same from policy.

### 4.3 Delivery phases for packaging

| Phase | Scope |
|-------|--------|
| **P0** | Catalog + plans + tenant assign UI; write flags; gate nav; gate 2–3 real APIs |
| **P1** | Full module gating; trial dates; audit entitlement changes |
| **P2** | Payments (PayFast), invoices, dunning, self-serve upgrade request |

---

## 5. SYS accounts (enter any tenant)

### 5.1 Problem

`PLATFORM_ADMIN` has `tenantId = null`. `TenantAccessGuard` requires JWT `tenantId === X-Tenant-Id`, so platform staff **cannot** use tenant-admin today. Creating a real `TENANT_ADMIN` per tenant for support is insecure and breaks audit.

### 5.2 Recommended model: SYS + impersonation

**New role:** `SYS` (or `PLATFORM_SUPPORT`) on `platform.auth_users`  
- Created only by `PLATFORM_ADMIN` in system-admin (**Sys accounts** page).  
- Can **not** change platform billing/catalog unless also platform admin (keep roles separate).  
- Permission: `canEnterTenants = true`.

**Flow: “Enter tenant”**

1. SYS (or PLATFORM_ADMIN with flag) opens Tenants → **Enter**.  
2. API: `POST /v1/auth/impersonate` `{ tenantSlug }`  
3. Issues **short-lived** JWT (e.g. 1–4 hours):  
   - `role: TENANT_ADMIN` (or `SYS_IMPERSONATOR`)  
   - `tenantId: <slug>`  
   - `impersonatorId`, `impersonation: true`  
4. Redirect to tenant-admin with cookies set; persistent banner:  
   **“SYS: viewing {Tenant} — End session”**  
5. All writes audit with `actor = SYS email` + `impersonation: true`.

**Hard rules**
- No password of tenant admin ever used.  
- MFA: SYS uses own MFA; do not bypass tenant MFA for real admins.  
- Optional: tenant allowlist / “break-glass” reason required.  
- End session invalidates refresh token family.  
- Device/IP allowlists: SYS may skip device binding (documented exception).

### 5.3 Alternative (not preferred)

Allow `PLATFORM_ADMIN` JWT to pass `TenantAccessGuard` when `X-Tenant-Id` is set. Faster but weaker audit and easier to abuse. Prefer dedicated impersonation tokens.

### 5.4 UI

| Page | Actions |
|------|---------|
| **Sys accounts** | Create/deactivate SYS users |
| **Tenants** | Enter tenant / End (if active) |
| **Audit** | Filter “impersonation sessions” |

---

## 6. Security & compliance notes

- Impersonation without audit is a non-starter for SA fleets (trust / disputes).  
- Entitlement changes should be audited (`platform.audit_logs`).  
- Do not put payment card data in VIT — redirect to PayFast/Stripe hosted checkout in P2.  
- POPIA: SYS access is processing personal data — log purpose, minimise retention of session metadata.

---

## 7. Suggested build order

1. **SYS impersonation** (unblocks support + demos immediately).  
2. **Module catalog + plan assignment + policy entitlements + nav gating**.  
3. **API guards** on sellable modules you already ship.  
4. **Commercial polish**: trials, invoices CSV, then PayFast.

Rough effort (one engineer familiar with the repo):  
- SYS: ~3–5 days  
- Packaging P0: ~1–2 weeks  
- Payments P2: separate project (~2–4 weeks + merchant setup)

---

## 8. Decisions for you to confirm

1. **Module list for v1** — keep the table in §3.1, or cut to a shorter set?  
2. **SYS vs PLATFORM_ADMIN** — separate `SYS` role, or “Enter tenant” for platform admins only?  
3. **Payments timing** — Phase 1 manual entitlements only, or start PayFast in the same release?  
4. **Driver app** — gate mobile tabs by entitlements in P0, or admin-only first?  
5. **Pricing** — display-only prices in platform admin for now, or omit money until PayFast?

Reply with preferences and we can turn this into an implementation plan / branch.

---

## 9. Out of scope for this proposal

- Rewriting multi-tenancy  
- Association roll-up product (strategy P1)  
- Hardware POS / cashless settlement  
- Changing current SMTP / monthly report behaviour  

---

*Prepared from current VIT codebase state (feature_flags placeholder, maxDrivers limits, no impersonation). Review and mark decisions in §8 before build.*
