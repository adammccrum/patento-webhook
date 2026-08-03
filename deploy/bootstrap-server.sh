#!/usr/bin/env bash
#
# One-time server preparation. Fasthosts VPS, Ubuntu 22.04 or 24.04 LTS.
#
# Run once as root on a freshly provisioned box:
#
#   ssh root@<ip>
#   curl -fsSL <raw-url>/deploy/bootstrap-server.sh -o bootstrap.sh
#   bash bootstrap.sh
#
# Idempotent: safe to run twice. Every step checks before acting, because the
# usual reason to re-run it is that something failed halfway.
#
# It will REFUSE to disable password authentication until an SSH key is
# actually installed. Hardening a box you can no longer log into is the most
# common way to lose a server on day one, and the check is the difference
# between careful and locked out.
set -euo pipefail

APP_USER="${APP_USER:-lao}"
APP_DIR="${APP_DIR:-/opt/lao}"

say() { echo -e "\n[bootstrap] $*"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

# ------------------------------------------------------------------ system ---
say "updating packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg git ufw unattended-upgrades

timedatectl set-timezone UTC || true

# Security patches apply themselves. On a box with three users and no ops
# rota, the alternative is that they are applied by nobody.
say "enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades || true

# ----------------------------------------------------------------- swap ------
# 4 GB is enough to run LAO and just about enough to build it. Swap costs a
# little disk and turns a build-time OOM kill into a slow build.
if ! swapon --show | grep -q '/swapfile'; then
  say "creating 2G swapfile"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10 >/dev/null
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  say "swap already present"
fi

# ------------------------------------------------------------------ user -----
if ! id "$APP_USER" >/dev/null 2>&1; then
  say "creating $APP_USER"
  adduser --disabled-password --gecos "" "$APP_USER"
  usermod -aG sudo "$APP_USER"
else
  say "$APP_USER already exists"
fi

# Carry root's keys across, so the new account is reachable before root stops
# being.
if [ -f /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
  install -m 600 -o "$APP_USER" -g "$APP_USER" /root/.ssh/authorized_keys "/home/$APP_USER/.ssh/authorized_keys"
  say "copied SSH keys to $APP_USER"
fi

# ----------------------------------------------------------------- docker ----
if ! command -v docker >/dev/null 2>&1; then
  say "installing Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  say "Docker already installed"
fi

usermod -aG docker "$APP_USER"
systemctl enable --now docker

# Container logs are the usual way a small VPS fills its disk quietly.
if [ ! -f /etc/docker/daemon.json ]; then
  say "capping container log size"
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
fi

# --------------------------------------------------------------- firewall ----
say "configuring firewall"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status verbose

# Fasthosts may also apply a firewall in their control panel, outside the OS.
# If 80 or 443 are unreachable from outside while ufw shows them open, that
# panel is the place to look — and Let's Encrypt validation will fail until
# both agree.
say "NOTE: check the Fasthosts panel firewall too — ufw is not the only one"

# --------------------------------------------------------------- app dir -----
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR/backups"

# ------------------------------------------------------------ ssh hardening --
KEYS="/home/$APP_USER/.ssh/authorized_keys"
if [ -s "$KEYS" ]; then
  say "hardening SSH — key authentication is present, so this is safe"
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  # Ubuntu 24.04 ships drop-ins that re-enable password auth after the main
  # file is read. Editing only sshd_config there changes nothing.
  if [ -d /etc/ssh/sshd_config.d ]; then
    printf 'PermitRootLogin no\nPasswordAuthentication no\n' > /etc/ssh/sshd_config.d/99-lao.conf
  fi
  sshd -t && systemctl reload ssh
  echo "    root login and password authentication are now disabled"
else
  say "SKIPPED SSH hardening — no key found at $KEYS"
  echo "    Password login is still enabled, which is not where this should end."
  echo "    From your Mac:  ssh-copy-id $APP_USER@<this-server>"
  echo "    Then re-run this script; it will finish the job."
fi

say "done"
echo "
Next:
  ssh $APP_USER@<ip>
  git clone <repo> $APP_DIR && cd $APP_DIR
  cp .env.example deploy/.env && \$EDITOR deploy/.env
  deploy/deploy.sh

Do not start Caddy until DNS resolves to this server. Let's Encrypt validates
by connecting to the domain, and failures count against 5 per week."
