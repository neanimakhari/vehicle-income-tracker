# OneSignal push notifications (tenant-admin)

**Branch:** `feature/onesignal-notifications`  
**Status:** Scaffolded — **do not deploy** until OneSignal credentials are set.  
**Sender:** Tenant Admin → `POST /tenant/notifications/send` → Nest → OneSignal REST.

---

## Goal

Let a tenant admin compose a notification in Admin Console and push it to drivers (and optionally other tenant admins) on the Flutter app via OneSignal.

---

## Architecture

```
Tenant Admin UI (/notifications)
        │  JWT + X-Tenant-Id
        ▼
Nest  POST /v1/tenant/notifications/send   [@RequiresModule('notifications')]
        │  1. Persist row in tenant_*."notifications"
        │  2. Resolve recipient user UUIDs by targetRole
        │  3. OneSignalClient.createNotification(...)
        ▼
OneSignal REST  POST https://api.onesignal.com/notifications
        │  include_aliases.external_id = [user UUIDs]
        ▼
Flutter app (OneSignal SDK + OneSignal.login(userId))
```

**Identity model:** `external_id` = auth/driver user UUID (same id already in JWT `sub`).  
Optional fallback: `device_bindings.push_token` as OneSignal subscription / player IDs.

---

## Credentials (you will provide later)

| Env var | Where | Purpose |
|---------|--------|---------|
| `ONESIGNAL_APP_ID` | `deploy/.env` + Flutter `--dart-define` | App id |
| `ONESIGNAL_REST_API_KEY` | `deploy/.env` only (secret) | Server REST key |
| `ONESIGNAL_ENABLED` | `deploy/.env` | `true` to send; default off so empty keys are safe |

OneSignal dashboard: create Android (FCM) (+ iOS later), copy App ID + REST API Key.

---

## Recipient rules

| `targetRole` | Recipients |
|--------------|------------|
| `TENANT_USER` | Active drivers in tenant schema `users` |
| `TENANT_ADMIN` | Active `platform.auth_users` with `role=TENANT_ADMIN` for this tenant |
| `null` / empty | Both |

---

## Phases

1. **Done on this branch** — API module, OneSignal client (no-op until enabled), env placeholders, plan doc, tenant-admin send feedback, Flutter prep stubs.
2. **When credentials arrive** — set env, enable flag, rebuild api only; add `onesignal_flutter` + `OneSignal.login(userId)` on driver login; smoke-send from tenant-admin.
3. **Later** — mark-read inbox, deep links, wire tracking/missing-income into the centre, iOS APNs.

---

## Commercial gate

Module key `notifications` (Pro). UI already shows `ModuleLocked` without entitlement.

---

## Local / prod smoke (after credentials)

```bash
# API must have ONESIGNAL_* set and ONESIGNAL_ENABLED=true
curl -sS -X POST "$API/v1/tenant/notifications/send" \
  -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: $SLUG" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Hello from VIT","targetRole":"TENANT_USER"}'
```

Expect `status: sent` (or `sent_no_devices` if no OneSignal logins yet) and a `push` object in the JSON body.
