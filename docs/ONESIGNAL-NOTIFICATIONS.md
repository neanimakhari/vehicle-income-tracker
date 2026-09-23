# OneSignal push notifications (tenant-admin)

**Branch:** `feature/onesignal-notifications`  
**Status:** Live on production API; FCM service account configured in OneSignal; mobile **1.0.11+12**.  
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

## Credentials

| Env var | Where | Purpose | Status |
|---------|--------|---------|--------|
| `ONESIGNAL_APP_ID` | `deploy/.env` + Flutter `--dart-define` | App id | Have: `8c514c8b-305c-45b2-ba6f-4ef92fa77ed0` |
| `ONESIGNAL_REST_API_KEY` | `deploy/.env` only (secret) | Server REST key | Have (stored outside git — not pasted here) |
| `ONESIGNAL_ENABLED` | `deploy/.env` | `true` to send | `true` in prod |

OneSignal dashboard: **Settings → Keys & IDs** for App ID + REST key.

---

## Firebase Android (required for device push)

OneSignal delivers Android via FCM. Do this in **Firebase Console**, not OneSignal first:

1. [console.firebase.google.com](https://console.firebase.google.com) → create/open project  
2. **Add app → Android**  
3. **Android package name (must match VIT APK):** `co.za.vehinc.vit`  
4. Register (nickname optional; SHA-1 optional for now)  
5. OneSignal → **Settings → Push & In-App → Google Android (FCM)** → choose **Flutter** SDK → upload Firebase **service account JSON**

Do **not** add `google-services.json` / Google Services Gradle plugin for OneSignal — the Flutter SDK registers FCM itself.

### Flutter SDK (integrated on this branch)

- Package: `onesignal_flutter` **5.5.2** (Stable from onesignal releases.json)
- App ID hardcoded for init: `8c514c8b-305c-45b2-ba6f-4ef92fa77ed0`
- Wrapper: `app/lib/services/onesignal_push.dart` (`OneSignalService`)
- Init in `main()`; verification dialog via `OneSignalVerificationHost`; `login(userId)` after driver login
- Platforms: **Android** native + shared Dart. iOS NSE deferred (Runner bundle still `com.example.app`)

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
3. **Next** — mark-read inbox, deep links from push, wire tracking/missing-income into the centre, iOS APNs.

In-app: driver **Alerts** lists recent tenant notifications (push is separate).

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
