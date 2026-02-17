## Data Classification Policy

## Purpose
Define categories for data sensitivity and handling requirements.

## Classes
- **Public**: Approved for public release.
- **Internal**: Non-public operational data.
- **Confidential**: Tenant data, PII, financial records.
- **Restricted**: Secrets, credentials, encryption keys.

## Handling
- Confidential/Restricted data must be encrypted at rest and in transit.
- Restricted data stored only in approved secret managers.
- Access limited by RBAC and logged for audit.


