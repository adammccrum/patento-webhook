# Go-live evidence — LAO beta

**Status: NOT DEPLOYED. No evidence recorded.**

Every row below is empty because nothing has been run. This file is the record
that go-live actually happened, filled in as it does, and it follows the same
rule as the rest of this project: a claim without evidence beside it is not a
claim, it is a hope.

Fill in the observed result — the actual output, not "OK". Where a row cannot
pass, write why. A row left blank is a row nobody checked.

| Field | Value |
|---|---|
| Domain | `learnaionlineacademy.co.uk` |
| Host | Fasthosts Cloud VPS 4 — 4 vCPU / 4 GB / 120 GB NVMe |
| DNS | Fasthosts Cloud Panel |
| Deployed commit | *(not deployed)* |
| Date | *(not deployed)* |
| Operator | *(the Founder — the assistant has no access to the server)* |

---

## 1. Host

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 1.1 | OS | Ubuntu 22.04 or 24.04 LTS | | ☐ |
| 1.2 | Docker installed | `docker --version` | | ☐ |
| 1.3 | Firewall | `ufw` allows 22, 80, 443 only | | ☐ |
| 1.4 | Fasthosts panel firewall | 80 and 443 open there too | | ☐ |
| 1.5 | SSH hardened | password auth and root login disabled | | ☐ |
| 1.6 | Swap | 2 GB present | | ☐ |

## 2. Build

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 2.1 | **Image builds** | `docker build` succeeds — **never yet attempted anywhere** | | ☐ |
| 2.2 | Container starts | `apps/lao-web/server.js` runs | | ☐ |
| 2.3 | Container healthy | `docker compose ps` shows `healthy`, not merely `Up` | | ☐ |

## 3. Database

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 3.1 | Migrations applied | 33 tables | | ☐ |
| 3.2 | Seed | Course 1 with 5 missions | | ☐ |
| 3.3 | Not exposed | 5432 unreachable from the internet | | ☐ |
| 3.4 | Backup | `deploy/backup.sh` produces a dump | | ☐ |
| 3.5 | **Restore verified** | `backup.sh --verify` restores and counts rows | | ☐ |
| 3.6 | Backup scheduled | cron installed, first run observed | | ☐ |

## 4. HTTPS

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 4.1 | DNS resolves | A and www return the VPS IP | | ☐ |
| 4.2 | Certificate issued | issuer is Let's Encrypt, not self-signed | | ☐ |
| 4.3 | Expiry | ~90 days out | | ☐ |
| 4.4 | HTTP redirects | 301 to HTTPS | | ☐ |
| 4.5 | www redirects | 301 to the apex | | ☐ |
| 4.6 | HSTS | header present | | ☐ |

## 5. Email

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 5.1 | Resend domain | verified in the dashboard | | ☐ |
| 5.2 | SPF | `spf=pass` in a received header | | ☐ |
| 5.3 | DKIM | `dkim=pass` in a received header | | ☐ |
| 5.4 | DMARC | `_dmarc` published at `p=none` | | ☐ |
| 5.5 | Existing mail preserved | prior MX records recreated, or confirmed none existed | | ☐ |

## 6. The journey — as a person, not as curl

| # | Check | Expected | Observed | Pass |
|---|---|---|---|---|
| 6.1 | Register | account created | | ☐ |
| 6.2 | **Confirmation email received** | in an inbox, not a log | | ☐ |
| 6.3 | Verify link | confirms the account | | ☐ |
| 6.4 | Sign in | reaches the dashboard | | ☐ |
| 6.5 | Course visible | Course 1, 5 missions | | ☐ |
| 6.6 | Complete a mission | progress recorded | | ☐ |
| 6.7 | **Reset email received** | in an inbox | | ☐ |
| 6.8 | Reset link | lands on the page — **it was a 404 until `c89f017`** | | ☐ |
| 6.9 | New password works | signs in | | ☐ |
| 6.10 | Old password refused | rejected | | ☐ |
| 6.11 | **Collaborator suggests something** | a real suggestion, not the degraded message | | ☐ |
| 6.12 | Export | returns the account's data | | ☐ |
| 6.13 | Delete | removes it | | ☐ |

## 7. Known, and not blocking

| Item | State |
|---|---|
| Master logo | Not supplied. `brand-conformance.test.ts` fails deliberately — the 1 failing test in every run. A release gate, not a beta blocker. |
| Provider verification in staging | Not run. Needs live credentials. |

---

## Sign-off

Beta is live when every row above is filled and every ☐ that can pass has.

- [ ] Evidence complete
- [ ] Founder has run the journey personally
- [ ] Backup restore verified **before** anyone else is invited
- [ ] URL sent to Michael and Keith

| | Name | Date |
|---|---|---|
| Deployed by | | |
| Verified by | | |
