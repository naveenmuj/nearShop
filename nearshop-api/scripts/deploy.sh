#!/bin/bash
# =============================================================================
# NearShop API — VM Deployment Script
# Supports Ubuntu 20.04, 22.04, 24.04
# Run as root: bash deploy.sh
# =============================================================================

set -e

APP_DIR="/opt/nearshop"
APP_USER="nearshop"
DOMAIN="api.nearshop.yourdomain.com"   # <-- CHANGE THIS before running

echo ""
echo "=========================================="
echo " NearShop API Deployment"
echo "=========================================="

# ── Detect Ubuntu version ─────────────────────────────────────────────────────
UBUNTU_VERSION=$(lsb_release -rs 2>/dev/null || echo "unknown")
echo ""
echo "  OS: $(lsb_release -ds 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME | cut -d= -f2)"
echo "  IP: $(hostname -I | awk '{print $1}')"
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq

# Install prerequisites for adding PPAs
apt-get install -y --no-install-recommends \
    software-properties-common \
    curl \
    git \
    ufw

# Add deadsnakes PPA for Python 3.11 (works on Ubuntu 20.04, 22.04, 24.04)
echo "  Adding deadsnakes PPA for Python 3.11..."
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update -qq

# Install Python 3.11
apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3.11-distutils

# Install other system deps
apt-get install -y --no-install-recommends \
    python3-pip \
    libpq-dev \
    libjpeg-dev \
    libwebp-dev \
    nginx \
    redis-server \
    certbot \
    python3-certbot-nginx

# Verify python3.11 works
PYTHON_BIN=$(which python3.11)
echo "  Python: $($PYTHON_BIN --version)"
echo "  System packages installed."

# ── 2. Create app user ────────────────────────────────────────────────────────
echo "[2/8] Creating app user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home "$APP_DIR" --create-home "$APP_USER"
    echo "  User '$APP_USER' created."
else
    echo "  User '$APP_USER' already exists."
fi

# ── 3. App directory, venv, dependencies ──────────────────────────────────────
echo "[3/8] Setting up virtualenv and installing dependencies..."
mkdir -p "$APP_DIR"

# Create venv with Python 3.11
if [ ! -d "$APP_DIR/venv" ]; then
    $PYTHON_BIN -m venv "$APP_DIR/venv"
    echo "  Virtualenv created."
fi

# Upgrade pip
"$APP_DIR/venv/bin/pip" install --upgrade pip --quiet

# Install app dependencies (must have requirements.txt in APP_DIR already)
if [ -f "$APP_DIR/requirements.txt" ]; then
    echo "  Installing Python packages (this takes ~2 min)..."
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" --quiet
    echo "  Python packages installed."
else
    echo "  WARNING: $APP_DIR/requirements.txt not found."
    echo "  Upload your code first, then re-run or run pip manually."
fi

# ── 4. Environment file ───────────────────────────────────────────────────────
echo "[4/8] Configuring environment..."
if [ ! -f "$APP_DIR/.env" ]; then
    if [ -f "$APP_DIR/.env.production" ]; then
        cp "$APP_DIR/.env.production" "$APP_DIR/.env"
        echo "  Copied .env.production -> .env"
    else
        echo "  WARNING: No .env file found at $APP_DIR/.env"
        echo "  Create it manually before starting the service."
    fi
fi

if [ -f "$APP_DIR/.env" ]; then
    chmod 600 "$APP_DIR/.env"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo "  Permissions set."

# ── 5. Redis ──────────────────────────────────────────────────────────────────
echo "[5/8] Configuring Redis..."
# Bind Redis to localhost only
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf

# Set memory limit (only add if not already present)
grep -q "^maxmemory 128mb" /etc/redis/redis.conf || echo "maxmemory 128mb" >> /etc/redis/redis.conf
grep -q "^maxmemory-policy" /etc/redis/redis.conf || echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf

systemctl enable redis-server
systemctl restart redis-server
# Quick check
redis-cli ping > /dev/null && echo "  Redis running (PONG received)."

# ── 6. systemd service ────────────────────────────────────────────────────────
echo "[6/8] Creating systemd service..."

# Detect vCPU count for worker sizing
VCPU=$(nproc)
WORKERS=$((VCPU * 2))
echo "  Detected $VCPU vCPU(s) — using $WORKERS Gunicorn workers."

mkdir -p /var/log/nearshop
chown "$APP_USER:$APP_USER" /var/log/nearshop

cat > /etc/systemd/system/nearshop-api.service << EOF
[Unit]
Description=NearShop API (FastAPI/Gunicorn)
After=network.target redis.service
Wants=redis.service

[Service]
Type=notify
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment="PATH=$APP_DIR/venv/bin"
EnvironmentFile=$APP_DIR/.env
ExecStart=$APP_DIR/venv/bin/gunicorn app.main:app \\
    --workers $WORKERS \\
    --worker-class uvicorn.workers.UvicornWorker \\
    --bind 127.0.0.1:8000 \\
    --timeout 120 \\
    --keep-alive 5 \\
    --max-requests 1000 \\
    --max-requests-jitter 100 \\
    --log-level info \\
    --access-logfile /var/log/nearshop/access.log \\
    --error-logfile /var/log/nearshop/error.log
ExecReload=/bin/kill -s HUP \$MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nearshop-api
echo "  systemd service created and enabled."

# ── 7. Nginx ──────────────────────────────────────────────────────────────────
echo "[7/8] Configuring Nginx..."

cat > /etc/nginx/sites-available/nearshop-api << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip
    gzip on;
    gzip_types application/json text/plain text/css application/javascript;
    gzip_min_length 1024;

    # Max upload size
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_buffering off;
    }

    location /static/ {
        alias /opt/nearshop/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/nearshop-api /etc/nginx/sites-enabled/nearshop-api
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl enable nginx && systemctl reload nginx
echo "  Nginx configured (serving on port 80 for all domains)."
echo "  Run 'certbot --nginx' later to add SSL for your domain."

# ── 8. Firewall ───────────────────────────────────────────────────────────────
echo "[8/8] Configuring firewall..."
ufw --force reset > /dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "  Firewall: SSH + HTTP + HTTPS allowed."

# ── Done ──────────────────────────────────────────────────────────────────────
VM_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "=========================================="
echo " Setup complete!"
echo "=========================================="
echo ""
echo "NEXT STEPS (do these in order):"
echo ""
echo "  1. Upload your .env file:"
echo "     scp .env.production root@$VM_IP:$APP_DIR/.env"
echo "     nano $APP_DIR/.env   # set JWT_SECRET_KEY + ALLOWED_ORIGINS"
echo ""
echo "  2. Upload Firebase service account:"
echo "     scp firebase-service-account.json root@$VM_IP:$APP_DIR/"
echo ""
echo "  3. Start the API:"
echo "     systemctl start nearshop-api"
echo "     systemctl status nearshop-api"
echo ""
echo "  4. Test it (by IP, no domain needed yet):"
echo "     curl http://$VM_IP/api/v1/health"
echo ""
echo "  5. Point your domain A record to: $VM_IP"
echo "     Then add SSL:"
echo "     certbot --nginx -d $DOMAIN"
echo ""
echo "  6. Monitor logs:"
echo "     journalctl -u nearshop-api -f"
echo "     tail -f /var/log/nearshop/error.log"
echo ""
