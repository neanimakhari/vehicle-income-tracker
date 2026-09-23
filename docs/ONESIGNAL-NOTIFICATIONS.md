# OneSignal push notifications (tenant-admin)

**Branch:** `feature/onesignal-notifications`  
**Status:** Live — inbox (mark-read + badge), deep links, auto-alerts (missing income / tracking admins / maintenance both). Mobile **1.0.12+13**.

**Sender:** Tenant Admin → `POST /tenant/notifications/send` → Nest → OneSignal REST.  
**Auto:** missing-income cron, geofence fires (tenant admins), maintenance daily cron (drivers + admins).

---

## Goal

Let a tenant admin compose a notification in Admin Console and push it to drivers (and optionally other tenant admins) on the Flutter app via OneSignal. System events use the same centre.

---

## Architecture

```
Tenant Admin UI (/notifications)  OR  auto producers (cron / geofence)
        │  JWT + X-Tenant-Id  (or internal publish)
        ▼
Nest  TenantNotificationsService.publish(...)
        │  1. Persist row (+ source, deep_link, meta)
        │  2. Resolve recipient user UUIDs
        │  3. OneSignalClient.createNotification(...)
        ▼
OneSignal REST  include_aliases.external_id = [user UUIDs]
        ▼
Flutter: Alerts inbox + badge; tap push → vitapp:// deep link
```

**Identity model:** `external_id` = auth/driver user UUID (JWT `sub`).

---

## Inbox APIs

| Method | Path | Notes |
|--------|------|--------|
| GET | `/tenant/notifications` | Inbox (`read`, `source`, `deepLink`); drivers/admins filtered |
| GET | `/tenant/notifications?view=sent` | Admin compose log + `audienceCount` / `readCount` |
| GET | `/tenant/notifications/:id/reads` | Who read (names, emails, timestamps) |
| GET | `/tenant/notifications/unread-count` | Badge |
| POST | `/tenant/notifications/:id/read` | Mark one |
| POST | `/tenant/notifications/read-all` | Clear noise |

---

## Auto-alert targets

| Source | Recipients |
|--------|------------|
| Missing income | Each driver + admin digest |
| Geofence / tracking | **Tenant admins only** |
| Maintenance overdue/due_soon | **Drivers (recent vehicle) + admins** |

---

## Credentials

| Env var | Where | Purpose | Status |
|---------|--------|---------|--------|
| `ONESIGNAL_APP_ID` | `deploy/.env` + Flutter | App id | Live |
| `ONESIGNAL_REST_API_KEY` | `deploy/.env` only | Server REST key | Live |
| `ONESIGNAL_ENABLED` | `deploy/.env` | `true` to send | `true` in prod |

---

## Phases

1. **Done** — API module, OneSignal client, Flutter SDK, manual send, Alerts list.
2. **Done** — Mark-read inbox + badge; deep links; auto-alerts as above.
3. **Done** — Admin “who read” delivery/read stats on tenant-admin Notifications.
4. **Later** — iOS APNs only (geofence alerts stay admin-only; drivers must not see fence enter/exit).

---

## Commercial gate

Module key `notifications` (Pro).
