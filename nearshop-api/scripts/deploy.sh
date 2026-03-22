#!/bin/bash
# =============================================================================
# NearShop API — VM Deployment Script (Ubuntu 22.04 LTS)
# Run as root or sudo user on the VM
# Usage: bash deploy.sh
# =============================================================================

set -e  # Exit on any error

APP_DIR="/opt/nearshop"
APP_USER="nearshop"
PYTHON_VERSION="3.11"
REPO_URL="your-git-repo-url"   # Set this if using git clone

echo ""
echo "=========================================="
echo " NearShop API Deployment"
echo "=========================================="
echo ""

# ── 1. System packages ────────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
apt-get update -qq
apt-get install -y --no-install-recommends \
    python3.11 \
    python3.11-venv \
    python3.11-dev \
    python3-pip \
    python3-psycopg2 \
    libpq-dev \
    libjpeg-turbo8-dev \
    libwebp-dev \
    nginx \
    redis-server \
    certbot \
    python3-certbot-nginx \
    ufw \
    git \
    curl
echo "  System packages installed."

# ── 2. Create app user ────────────────────────────────────────────────────────
echo "[2/8] Creating app user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/bash --home "$APP_DIR" --create-home "$APP_USER"
    echo "  User '$APP_USER' created."
else
    echo "  User '$APP_USER' already exists."
fi

# ── 3. Create directory & venv ────────────────────────────────────────────────
echo "[3/8] Setting up app directory and virtualenv..."
mkdir -p "$APP_DIR"

# Copy app files (run this from your local machine, or clone from git)
# rsync -avz --exclude='__pycache__' --exclude='.env' --exclude='*.pyc' \
#     /path/to/nearshop-api/ nearshop@YOUR_VM_IP:$APP_DIR/

# Create venv
python3.11 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --upgrade pip --quiet

# Install dependencies
"$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" --quiet
echo "  Virtualenv and dependencies installed."

# ── 4. Environment file ───────────────────────────────────────────────────────
echo "[4/8] Configuring environment..."
if [ ! -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env.production" "$APP_DIR/.env"
    echo "  IMPORTANT: Edit $APP_DIR/.env with your real values!"
    echo "  Especially: JWT_SECRET_KEY must be changed!"
fi
chmod 600 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
echo "  Environment configured."

# ── 5. Redis configuration ────────────────────────────────────────────────────
echo "[5/8] Configuring Redis..."
# Bind Redis to localhost only (not exposed externally)
sed -i 's/^bind .*/bind 127.0.0.1 -::1/' /etc/redis/redis.conf
sed -i 's/^# maxmemory .*/maxmemory 128mb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server
echo "  Redis configured (127.0.0.1 only, 128MB max)."

# ── 6. systemd service ────────────────────────────────────────────────────────
echo "[6/8] Creating systemd service..."
cat > /etc/systemd/system/nearshop-api.service << 'EOF'
[Unit]
Description=NearShop API (FastAPI/Gunicorn)
After=network.target redis.service
Wants=redis.service

[Service]
Type=notify
User=nearshop
Group=nearshop
WorkingDirectory=/opt/nearshop
Environment="PATH=/opt/nearshop/venv/bin"
EnvironmentFile=/opt/nearshop/.env
ExecStart=/opt/nearshop/venv/bin/gunicorn app.main:app \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 127.0.0.1:8000 \
    --timeout 120 \
    --keepalive 5 \
    --max-requests 1000 \
    --max-requests-jitter 100 \
    --log-level info \
    --access-logfile /var/log/nearshop/access.log \
    --error-logfile /var/log/nearshop/error.log
ExecReload=/bin/kill -s HUP $MAINPID
KillMode=mixed
TimeoutStopSec=5
PrivateTmp=true
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

mkdir -p /var/log/nearshop
chown nearshop:nearshop /var/log/nearshop

systemctl daemon-reload
systemctl enable nearshop-api
echo "  systemd service created."

# ── 7. Nginx reverse proxy ────────────────────────────────────────────────────
echo "[7/8] Configuring Nginx..."

# Replace api.nearshop.yourdomain.com with your actual domain
DOMAIN="api.nearshop.yourdomain.com"

cat > /etc/nginx/sites-available/nearshop-api << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types application/json text/plain;
    gzip_min_length 1024;

    # Request size limit (for file uploads)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # Static files served by Nginx directly (faster)
    location /static/ {
        alias /opt/nearshop/static/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/nearshop-api /etc/nginx/sites-enabled/nearshop-api
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx configured. Update domain in /etc/nginx/sites-available/nearshop-api"

# ── 8. Firewall ───────────────────────────────────────────────────────────────
echo "[8/8] Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "  Firewall enabled (SSH + HTTP/HTTPS only)."

echo ""
echo "=========================================="
echo " Deployment complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env:         nano $APP_DIR/.env"
echo "  2. Copy service acct: cp firebase-service-account.json $APP_DIR/"
echo "  3. Run migrations:    cd $APP_DIR && venv/bin/alembic upgrade head"
echo "  4. Start service:     systemctl start nearshop-api"
echo "  5. Check status:      systemctl status nearshop-api"
echo "  6. Setup SSL:         certbot --nginx -d $DOMAIN"
echo "  7. View logs:         journalctl -u nearshop-api -f"
echo ""
