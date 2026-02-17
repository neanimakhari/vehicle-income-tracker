# Backup and Recovery Policy

## Purpose
Ensure recoverability of critical data and services.

## Scope
Platform database, audit logs, and tenant data.

## Policy
- Daily full backups of production databases.
- Point-in-time recovery enabled where supported.
- Backups encrypted at rest and in transit.
- Retain backups for 30 days (or longer per tenant contract).

## Testing
- Perform restore tests quarterly.
- Document RTO/RPO results and remediation.

## Responsibilities
- Platform ops: backup configuration and monitoring.
- Security: audit backup access and compliance.


