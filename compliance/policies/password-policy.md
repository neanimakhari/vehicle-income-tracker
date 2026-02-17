# Password Policy

## Purpose
Define minimum password requirements and rotation guidance for platform users.

## Scope
All platform admins, tenant admins, and tenant users.

## Policy
- Minimum length: 12 characters.
- Must include at least three of: uppercase, lowercase, number, symbol.
- Passwords must be unique and not reused across the last 5 passwords.
- Passwords must never be shared or stored in plaintext.
- MFA is required for admins where enabled by policy.

## Rotation
- Admin passwords: rotate every 90 days.
- Tenant user passwords: rotate every 180 days or upon suspicion of compromise.
- Rotate immediately after a security incident.

## Enforcement
- Account lockout after 10 failed attempts within 15 minutes.
- Password reset requires verified email/phone and MFA if enabled.

## Exceptions
Exceptions must be documented and approved by security leadership.


