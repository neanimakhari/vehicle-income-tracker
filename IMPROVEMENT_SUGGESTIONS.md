# Improvement Suggestions for Vehicle Income Tracker

Ideas to make the app more useful, reliable, and pleasant to use.

---

## Driver app (Flutter)

- **Offline support** – Cache recent incomes, expenses, and maintenance so drivers can view and add entries when offline; sync when back online.
- **Quick add** – From the home/dashboard, one-tap “Add income” or “Log expense” with last-used vehicle and common values remembered.
- **Notifications** – Reminders for license/PRDP/medical expiry, and optional alerts for maintenance due or overdue.
- **Export / share** – Export income/expense reports (PDF or CSV) or share a summary link for a date range.
- **Dark mode** – Respect system theme or add an in-app toggle (if not already global).
- **Haptic feedback** – Light haptics on key actions (save, delete, biometric success) for better feel.
- **Trip / run logging** – Optional “Start trip” / “End trip” to associate incomes or expenses with a specific run.
- **Dashboard widgets** – Summary cards for “This week’s income”, “Pending maintenance”, “Documents expiring soon”.

---

## Tenant admin (web)

- **Bulk actions** – Select multiple drivers or vehicles and enable/disable, send MFA reminder, or export data.
- **Dashboard** – Tenant-level KPIs: total income, active drivers, vehicles due for maintenance, document expiry counts.
- **Audit log** – Who changed what and when (driver status, vehicle assignment, policy, etc.) with filters and export.
- **Driver/vehicle filters** – Filter drivers by status, MFA, tenant; filter vehicles by status, type, or assignment.
- **Report scheduling** – Schedule monthly or weekly reports to be emailed automatically to chosen addresses.
- **Document templates** – Templates for common documents (e.g. contracts, induction) with placeholders for driver/vehicle.

---

## Platform admin (system-admin)

- **Dashboard** – Richer KPIs: total drivers across all tenants, total income entries, tenants created in last 30 days, inactive/suspended tenants count; optional charts (tenants over time, usage by tenant).
- **Tenants** – Filters (active/inactive, by name/slug), search, export tenant list (CSV); per-tenant usage (driver count, income count, storage) and “view usage” link.
- **Audit log** – Filters by action type, date range, tenant (from metadata), actor; export CSV; show full row (actor, target type/id, metadata) in table or expandable row.
- **Platform admins** – Deactivate (disable) an admin instead of only creating; optional “last active” or last-login indicator; secure password-reset flow for other admins.
- **Health / system** – Page or widget for API health (e.g. `/health`), DB connectivity, optional disk usage for uploads; link to logs if available.
- **Global / tenant defaults** – Platform-wide default policy hints (e.g. recommend MFA); optional feature flags or limits per tenant (max drivers, max storage).
- **Alerts** – Platform-level notifications: tenant approaching limits, spike in failed logins, new tenant created; optional in-app or email digest.

---

## API / backend

- **Rate limiting** – Per-tenant and per-user limits to protect the API and avoid abuse.
- **Webhooks** – Notify external systems on events (e.g. new income, driver disabled, document uploaded).
- **API versioning** – Versioned routes (e.g. `/v1/...`) so mobile and web can upgrade without breaking old clients.
- **Health endpoint** – `/health` returning DB and critical dependencies status for monitoring and load balancers.

---

## Security & compliance

- **Session management** – List and revoke active sessions per user; optional “Log out all devices”.
- **Password policy** – Configurable complexity and expiry per tenant.
- **Data retention** – Tenant setting for how long to keep audit logs and soft-deleted data, with automated cleanup.

---

## UX and polish

- **Onboarding** – Short first-time flow for drivers (e.g. set profile, add first income) and for admins (invite first driver, add first vehicle).
- **Empty states** – Clear illustrations and one primary action when there are no incomes, vehicles, or drivers.
- **Loading and errors** – Skeleton loaders and retry buttons instead of blank screens or generic errors.
- **Accessibility** – Labels, focus order, and contrast that meet WCAG where possible; test with screen readers.

You can pick items from this list and implement them in order of impact and effort.
