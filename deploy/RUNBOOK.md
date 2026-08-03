# LAO go-live runbook

**Who runs this:** the Founder, from a terminal on the Mac.

Not because it is preferable, but because it is the only option. The assistant
preparing these steps has no SSH client and no outbound access on port 22 —
both verified, not assumed — so it cannot reach the VPS. **Server credentials
should not be pasted into the chat.** They cannot be used there, and a root
password in a transcript is a risk with no upside.

The split that works: run one stage, paste the output, get it checked, move on.
Every stage below ends with **PASTE THIS** — the evidence that decides whether
the next stage should start.

Nothing here changes DNS until stage 6. That is deliberate: Let's Encrypt
allows five validation failures per week per domain, and pointing DNS at a
server that is not yet serving is the easy way to spend them.

---

## Stage 0 — before touching the server

```bash
dig MX learnaionlineacademy.co.uk +short
dig NS learnaionlineacademy.co.uk +short
```

**Time-sensitive.** The zone has moved to the Fasthosts Cloud Panel. If the MX
lookup returns anything, that domain carries mail, and those records must be
recreated in the Cloud Panel or inbound mail stops — silently, with no bounce
and nothing in a log.

**PASTE THIS:** both outputs, even if empty.

---

## Stage 1 — reach the server, on a key

From the Mac. Replace `<VPS-IP>` throughout.

```bash
ssh-keygen -t ed25519 -C "lao-vps"        # skip if you already have a key
ssh-copy-id root@<VPS-IP>                  # uses the Fasthosts root password once
ssh root@<VPS-IP> 'echo connected; . /etc/os-release && echo "$PRETTY_NAME"; nproc; free -g | head -2'
```

**PASTE THIS:** the output of the last command. It confirms key login works and
tells me the OS — which decides whether the SSH-hardening drop-in is needed.

---

## Stage 2 — prepare the host

```bash
ssh root@<VPS-IP>
apt-get update -qq && apt-get install -y -qq git
git clone https://github.com/adammccrum/patento-webhook.git /opt/lao
cd /opt/lao && git checkout claude/lao-master-build-directive-ih1mi8
bash deploy/bootstrap-server.sh
```

Installs Docker, creates the `lao` user, adds swap, caps container logs, and
sets `ufw` to allow 22, 80, 443 and nothing else.

It will **refuse to disable password login** unless an SSH key is present for
the `lao` user — hardening a box you cannot log into is the usual way to lose
one on day one. If it says SKIPPED, run `ssh-copy-id lao@<VPS-IP>` from the Mac
and re-run the script.

**PASTE THIS:** the last 25 lines, including the `ufw status` table.

Then, in the **Fasthosts Cloud Panel**, check for a firewall of its own and
allow 80 and 443. This is a separate firewall from `ufw`. If they disagree,
Let's Encrypt fails and the cause is invisible from the server.

---

## Stage 3 — build the image

**This has never been run.** There is no Docker daemon in the environment where
the Dockerfile was written, so this is the first real test of it. Expect this
stage to be where problems appear, and paste failures rather than working
around them.

```bash
ssh lao@<VPS-IP>
cd /opt/lao
docker build -t lao:test . 2>&1 | tail -40
```

Ten to fifteen minutes on a cold cache.

**PASTE THIS:** the last 40 lines, whether it succeeds or fails.

---

## Stage 4 — configure, then deploy

```bash
cd /opt/lao
cp .env.example deploy/.env

openssl rand -base64 48    # NEXTAUTH_SECRET
openssl rand -base64 32    # POSTGRES_PASSWORD

nano deploy/.env
```

Set, at minimum:

```
DOMAIN=learnaionlineacademy.co.uk
LETSENCRYPT_EMAIL=<your email>
POSTGRES_PASSWORD=<generated above>
NEXTAUTH_SECRET=<generated above>
EMAIL_FROM=LAO Academy <noreply@send.learnaionlineacademy.co.uk>
EMAIL_API_URL=https://api.resend.com/emails
EMAIL_API_KEY=<Resend key, once it exists>
ANTHROPIC_API_KEY=<a key, so the collaborator actually works>
```

Generate the secrets **on the server**, in that terminal. `deploy/.env` is
gitignored and must stay that way.

```bash
deploy/deploy.sh --no-backup      # --no-backup is correct only on the first deploy
```

**PASTE THIS:** the final output, including `docker compose ps`.

Caddy will not obtain a certificate yet, because DNS does not point here. That
is expected and is not a failure.

---

## Stage 5 — prove it works before anyone can see it

```bash
curl -fsS http://localhost:3000/api/health && echo
docker compose -f deploy/docker-compose.prod.yml exec -T postgres \
  psql -U lao -d lao -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
```

Expect `33` tables. Then seed the content, once and deliberately:

```bash
docker compose -f deploy/docker-compose.prod.yml exec app \
  node node_modules/.bin/tsx packages/iriskey/database/src/seed.ts || \
docker compose -f deploy/docker-compose.prod.yml run --rm app npm run seed
```

**If both forms fail, stop and paste the error.** The standalone bundle may not
carry the seeder, in which case the fix is a one-shot container from the
builder stage — not a workaround typed at the prompt.

**PASTE THIS:** health output, table count, seed result.

---

## Stage 6 — DNS

Only now, with the stack proven on the server.

In the **Fasthosts Cloud Panel**, add the records from
`DEPLOYMENT_PLAN.md → DNS records`. TTL 300 until go-live.

```bash
# from the Mac, not the server
dig +short learnaionlineacademy.co.uk
dig +short www.learnaionlineacademy.co.uk
```

Both must return the VPS IP. **Wait until they do.** Then restart Caddy once —
once, not in a loop:

```bash
ssh lao@<VPS-IP> 'cd /opt/lao && docker compose -f deploy/docker-compose.prod.yml restart caddy'
```

**PASTE THIS:** the `dig` outputs, and
`docker compose -f deploy/docker-compose.prod.yml logs caddy | tail -30`.

---

## Stage 7 — the journey, end to end

Against the real domain, from the Mac. Not localhost.

```bash
curl -fsS https://learnaionlineacademy.co.uk/api/health && echo
curl -sI http://learnaionlineacademy.co.uk | head -3
echo | openssl s_client -connect learnaionlineacademy.co.uk:443 2>/dev/null \
  | openssl x509 -noout -issuer -dates
```

Then in a browser, as a real person would:

1. Register with a **real address you can read**
2. Receive the confirmation email — **in an inbox, not a log**
3. Follow the link, confirm, sign in
4. Sign out, use *forgot password*, receive it, follow it, set a new password,
   sign in with the new one
5. Open a solution and ask the collaborator for a suggestion. If it says it
   cannot suggest improvements, `ANTHROPIC_API_KEY` is missing — the app is
   working and telling the truth
6. In the received mail's headers, check `spf=pass` and `dkim=pass`

**PASTE THIS:** each result, pass or fail, into
`deploy/GO-LIVE-EVIDENCE.md`.

---

## If a stage fails

Stop. Paste the error. Do not work around it at the prompt — a fix typed into a
terminal exists only on that box and is gone the next time the server is
rebuilt. Whatever it is, it belongs in the repository.

Two specific traps:

- **Let's Encrypt failures are rate-limited to five per week.** If Caddy fails
  to get a certificate, read the log and fix the cause. Do not restart
  repeatedly. `acme_ca` in the Caddyfile switches to the staging CA for
  rehearsal, which issues untrusted certificates and has generous limits.
- **A migration cannot be reversed.** Prisma has no down-migrations. If a
  deploy fails after migrating, the route back is a restore, which is why
  `deploy.sh` takes a backup first.
