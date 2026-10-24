# Security Policy

Report suspected security issues privately to the maintainers, using GitHub private vulnerability reporting where available. Do not disclose credentials or exploit instructions in public issues.

Provide the affected version, reproduction steps and impact through a private channel. Do not test live systems or customer data without written permission.

Do not commit credentials, private keys, local environment files, personal data or access tokens. Store deployed secrets in the platform secret manager. A `.gitignore` entry does not remove already-tracked files or erase Git history; rotate exposed credentials and investigate prior commits.

Changes affecting identity, authorisation, approvals or autonomous execution require independent review and tests before deployment.
