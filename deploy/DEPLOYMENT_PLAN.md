# LAO beta deployment

For a public beta serving three people: Michael, Keith and the Founder.

**Not yet executable.** Three facts are outstanding and every one of them
changes the instructions. They are listed at the bottom, and nothing here
should be run until they are answered.

---

## The shape

One small VPS running three containers behind Caddy.

```
        internet
           │  443
      ┌────▼────┐   Let's Encrypt, automatic renewal
      │  caddy  │
      └────┬────┘
           │  3000 (internal only)
      ┌────▼────┐   Next.js standalone, migrates then serves
      │   app   │
      └────┬────┘
           │  5432 (internal only)
      ┌────▼────┐
      │postgres │   nightly dump, restore-verified
      └─────────┘
```

Neither the app nor the database publishes a port. The only thing reachable
from the internet is Caddy on 80 and 443.

**No Redis.** The app falls back to in-memory rate limiting and caching, which
is correct for one instance. Running it would mean a service to patch and back
up in exchange for nothing measurable at this size. Add it when there is more
than one instance — not before.

**Cost.** The VPS is the only recurring charge. Resend's free tier covers
3,000 emails a month, which is roughly 2,999 more than this beta needs. If the
Fasthosts product turns out to be more than about £10/month for a 2 vCPU /
4 GB box, it is worth comparing before committing — but hosting is bought, so
this is a note for renewal rather than a reason to move now.

---

## Order of operations

The sequence matters. Two steps fail permanently if taken early.

1. **Confirm the DNS provider** and whether the domain has existing mail.
2. **Provision the VPS** — Ubuntu LTS, Docker Engine, a non-root user, SSH keys
   only, `ufw` allowing 22, 80 and 443 and nothing else.
3. **DNS records** (table below). Point A/AAAA at the server.
4. **Wait for DNS to resolve** before starting Caddy. Let's Encrypt validates
   by connecting to the domain; issuing before DNS resolves fails, and
   **failures count against a limit of 5 per week per domain**. Getting this
   wrong locks you out of your own certificate for days. Check with
   `dig +short yourdomain` from somewhere other than the server.
5. **Verify Resend's domain records** before sending anything. Sending from an
   unverified domain trains spam filters against you at exactly the moment
   your only three users are receiving their first email.
6. **Deploy** (below).
7. **Seed** — once, deliberately: `docker compose exec app npx prisma db seed`
   or the repo's `npm run seed`. The entrypoint does not seed, because content
   should not appear because a container restarted.
8. **Verify** with the checklist.

---

## DNS records

**Provider unconfirmed.** Nameservers were changed and the destination has not
been established, so these go either in LCN or in Fasthosts — the values are
the same, the panel is not.

Replace `example.com` with the domain and `203.0.113.10` with the server IP.

| Type | Name | Value | TTL | Why |
|---|---|---|---|---|
| A | `@` | `203.0.113.10` | 300 | The site |
| A | `www` | `203.0.113.10` | 300 | Caddy redirects it to the apex |
| AAAA | `@` | *(server IPv6, if issued)* | 300 | Skip if the VPS has none |
| CAA | `@` | `0 issue "letsencrypt.org"` | 3600 | Only Let's Encrypt may issue for this domain |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@example.com` | 3600 | Reporting first, enforcement later |

**Use a 300-second TTL until go-live.** A 24-hour TTL on a wrong record means
a day of downtime; you can raise it once things are stable.

### Resend adds three more

Resend generates these per account — **the DKIM key is unique and cannot be
guessed or copied from anywhere.** Take them from the Resend dashboard after
adding the domain. Sending from the `send.` subdomain rather than the apex
keeps beta email reputation away from your main domain.

| Type | Name | Value | Why |
|---|---|---|---|
| MX | `send` | `feedback-smtp.<region>.amazonses.com` (priority 10) | Bounce and complaint handling |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF — authorises Resend to send |
| TXT | `resend._domainkey` | *(the long `p=MIGfMA0…` key Resend shows)* | DKIM — signs the mail |

Then set `EMAIL_FROM="LAO Academy <noreply@send.example.com>"`.

**On DMARC:** start at `p=none`. It reports without rejecting. Moving to
`p=quarantine` or `p=reject` before SPF and DKIM are confirmed passing will
send your own password-reset emails to spam, and the symptom — "the reset
email never arrives" — looks exactly like the bug that was just fixed.

### If the domain has a mailbox

Delegating nameservers replaces the whole zone. **Any existing MX records must
be recreated on the new nameservers or inbound mail stops** — silently, with no
bounce. Check with `dig MX example.com +short` before the change propagates.

---

## Deploy

```bash
ssh lao@203.0.113.10
git clone <repo> /opt/lao && cd /opt/lao
git checkout claude/lao-master-build-directive-ih1mi8

cp .env.example deploy/.env && $EDITOR deploy/.env   # see below
docker compose -f deploy/docker-compose.prod.yml up -d --build
docker compose -f deploy/docker-compose.prod.yml logs -f app
```

`deploy/.env` must set: `DOMAIN`, `LETSENCRYPT_EMAIL`, `POSTGRES_PASSWORD`,
`NEXTAUTH_SECRET`, `EMAIL_FROM`, `EMAIL_API_URL`, `EMAIL_API_KEY`, and at least
one model provider key.

Generate the secrets on the server, not in a password manager note:

```bash
openssl rand -base64 48   # NEXTAUTH_SECRET
openssl rand -base64 32   # POSTGRES_PASSWORD
```

`deploy/.env` is gitignored and must stay that way. Release criterion 3.6 fails
the clean-room build if an env file is ever committed.

---

## Rollback

Three failures, three procedures. Each assumes a backup exists, which is why
`deploy/backup.sh --verify` runs before any deploy.

### The new version is broken

```bash
cd /opt/lao
git log --oneline -5
git checkout <previous-good-sha>
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

Two to three minutes, and the database is untouched. This is the common case
and the reason to keep migrations additive.

### A migration made it worse

Prisma has no down-migrations, so the honest path is restore, not reverse.

```bash
docker compose -f deploy/docker-compose.prod.yml stop app
gunzip -c /opt/lao/backups/lao-<stamp>.sql.gz \
  | docker compose -f deploy/docker-compose.prod.yml exec -T postgres psql -U lao -d lao
git checkout <previous-good-sha>
docker compose -f deploy/docker-compose.prod.yml up -d --build
```

**Data written since that dump is gone.** With three beta users and nightly
backups the exposure is one day of their work — acceptable for a beta, and the
reason to take a manual backup immediately before any migration.

### TLS will not issue

Symptom: Caddy loops, the site serves plain HTTP or nothing.

```bash
docker compose -f deploy/docker-compose.prod.yml logs caddy | tail -50
```

Almost always DNS not yet resolving, or port 80 blocked. **Do not retry in a
loop** — every failure counts against 5 per week. Fix the cause, confirm with
`dig`, then restart Caddy once. If the limit is already spent, uncomment
`acme_ca` in the Caddyfile to rehearse against staging, which is
rate-limit-generous and issues untrusted certificates.

### Whole-server loss

Rebuild the VPS, reinstall Docker, clone, restore the newest dump, redeploy.
Recovery time is roughly 30 minutes, dominated by DNS if the IP changes. The
only irreplaceable thing on that box is `postgres_data`, which is why the
backup is the thing to test rather than the thing to configure.

---

## Go-live checklist

Nothing here is "looks fine". Each line is a thing observed.

**Before**

- [ ] `docker build` succeeds — **this has never been run.** No Docker daemon
      existed in the environment where the Dockerfile was written and fixed.
- [ ] `dig NS` and `dig MX` confirm the DNS provider and mail exposure
- [ ] A/AAAA resolve to the server from off-server
- [ ] `ufw status` shows only 22, 80, 443
- [ ] SSH password authentication disabled
- [ ] `deploy/.env` present, not committed, secrets generated on the server
- [ ] Resend domain shows **verified**
- [ ] `deploy/backup.sh --verify` passes — a restore, not a dump

**After**

- [ ] `https://domain/api/health` returns 200
- [ ] Certificate is Let's Encrypt and not self-signed:
      `echo | openssl s_client -connect domain:443 2>/dev/null | openssl x509 -noout -issuer -dates`
- [ ] `http://domain` redirects to HTTPS
- [ ] `https://www.domain` redirects to the apex
- [ ] Register a real account and **receive the email** — in an inbox, not a log
- [ ] Forgot password, **receive it**, follow the link, change the password,
      sign in with the new one
- [ ] Check the received mail's headers show `spf=pass` and `dkim=pass`
- [ ] Course 1 appears with its 5 missions
- [ ] The collaborator returns a real suggestion, not the degraded message
- [ ] `docker compose ps` shows every container **healthy**, not merely up
- [ ] Backup cron installed and the first run verified

**Then, and only then**, send the URL to Michael and Keith.

---

## Outstanding

Three answers block execution.

1. **Which Fasthosts product.** If it is shared hosting (cPanel/Plesk), none of
   this applies — LAO needs a long-running Node process, PostgreSQL and Docker,
   and the product would have to change.
2. **The domain name**, and where the nameservers now point.
3. **Whether that domain has a working mailbox**, before the delegation
   completes.

Two known gaps, neither of which blocks deployment but both of which affect the
beta:

- **The image has never been built.** First item on the checklist.
- **No model provider key.** The collaborator will tell Michael and Keith it
  cannot suggest improvements. They are being asked whether they would keep
  using LAO; answering that with the AI switched off answers a different
  question.
