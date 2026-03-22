# NearShop API — VM Deployment Guide

## Recommended VM Spec (DigitalOcean Droplet)

| Plan | vCPU | RAM | Price | Verdict |
|------|------|-----|-------|---------|
| Basic (s-1vcpu-1gb) | 1 | 1 GB | $6/mo | Minimum — workable |
| **Basic (s-1vcpu-2gb)** | **1** | **2 GB** | **$12/mo** | **Recommended** |
| Basic (s-2vcpu-2gb) | 2 | 2 GB | $18/mo | If >100 concurrent users |

**OS:** Ubuntu 22.04 LTS
**Architecture:** Direct venv + Gunicorn + Nginx + systemd
**Why not Docker:** ~80-120 MB RAM saved, 3-5% CPU saved, simpler ops

---

## Step 1 — Create & Connect to VM

```bash
# From your local machine
ssh root@YOUR_VM_IP
```

---

## Step 2 — System Setup

```bash
apt-get update && apt-get upgrade -y
apt-get install -y python3.11 python3.11-venv python3.11-dev \
    libpq-dev libjpeg-turbo8-dev libwebp-dev \
    nginx redis-server certbot python3-certbot-nginx ufw git
```

---

## Step 3 — Create App User & Directory

```bash
useradd --system --shell /bin/bash --home /opt/nearshop --create-home nearshop
```

---

## Step 4 — Upload Code to VM

**From your local Windows machine** (run in PowerShell/CMD):
```bash
# Option A: rsync (if WSL available)
rsync -avz --exclude='__pycache__' --exclude='*.pyc' --exclude='.git' \
    D:/Local_shop/nearshop-api/ root@YOUR_VM_IP:/opt/nearshop/

# Option B: SCP
scp -r D:/Local_shop/nearshop-api root@YOUR_VM_IP:/opt/nearshop

# Option C: Git (if repo is on GitHub/GitLab)
# On VM: git clone YOUR_REPO_URL /opt/nearshop
```

---

## Step 5 — Python Virtualenv & Dependencies

```bash
cd /opt/nearshop
python3.11 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r requirements.txt
```

---

## Step 6 — Configure Environment

```bash
# Copy the production template and edit it
cp /opt/nearshop/.env.production /opt/nearshop/.env
nano /opt/nearshop/.env
```

**Critical values to change:**

| Variable | Action |
|----------|--------|
| `JWT_SECRET_KEY` | Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | Already set to DigitalOcean (keep as-is) |
| `REDIS_URL` | Use `redis://127.0.0.1:6379/0` (local Redis) |
| `APP_ENV` | Set to `production` |
| `APP_DEBUG` | Set to `false` |
| `OTP_SMS_API_KEY` | Your SMS provider key |
| `R2_*` | Cloudflare R2 keys (for file uploads) |

```bash
# Upload Firebase service account
scp D:/Local_shop/nearshop-api/firebase-service-account.json root@YOUR_VM_IP:/opt/nearshop/

# Secure the env file
chmod 600 /opt/nearshop/.env
chown -R nearshop:nearshop /opt/nearshop
```

---

## Step 7 — Run Database Migrations

```bash
# Migrations already applied during local migration step
# Only run this for future schema changes:
cd /opt/nearshop
venv/bin/alembic upgrade head
```

---

## Step 8 — Configure Redis

```bash
# Bind to localhost only, limit memory
sed -i 's/^bind .*/bind 127.0.0.1/' /etc/redis/redis.conf

# Add to /etc/redis/redis.conf:
echo "maxmemory 128mb" >> /etc/redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf

systemctl enable redis-server
systemctl restart redis-server
redis-cli ping  # Should return: PONG
```

---

## Step 9 — Create systemd Service

```bash
cat > /etc/systemd/system/nearshop-api.service << 'EOF'
[Unit]
Description=NearShop API
After=network.target redis.service

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
systemctl start nearshop-api
systemctl status nearshop-api
```

**--workers 2** = good for 1 vCPU (1 CPU × 2 = 2 async workers)
For 2 vCPU: use `--workers 4`

---

## Step 10 — Configure Nginx

```bash
cat > /etc/nginx/sites-available/nearshop-api << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;   # <-- change this

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    gzip on;
    gzip_types application/json text/plain;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /static/ {
        alias /opt/nearshop/static/;
        expires 7d;
    }
}
EOF

ln -sf /etc/nginx/sites-available/nearshop-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

---

## Step 11 — SSL Certificate (HTTPS)

```bash
# Point your domain's A record to the VM IP first, then:
certbot --nginx -d api.yourdomain.com

# Auto-renewal is set up automatically
systemctl status certbot.timer
```

---

## Step 12 — Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## Step 13 — Update CORS in main.py

The API currently allows all origins in production. Update this before going live:

```python
# In app/main.py, change:
allow_origins=["*"] if settings.APP_ENV == "development" else [],
# To:
allow_origins=["https://yourwebapp.com", "https://www.yourwebapp.com"] if settings.APP_ENV == "production" else ["*"],
```

---

## Useful Commands

```bash
# View live logs
journalctl -u nearshop-api -f

# Restart after code update
systemctl restart nearshop-api

# Check if port is listening
ss -tlnp | grep 8000

# Test API locally on VM
curl http://127.0.0.1:8000/api/v1/health

# Check Redis
redis-cli ping
redis-cli info memory | grep used_memory_human

# Nginx logs
tail -f /var/log/nginx/error.log
tail -f /var/log/nearshop/access.log

# Check open connections to DigitalOcean DB
ss -tn state established | grep 25060
```

---

## Deploying Code Updates

```bash
# On VM — graceful reload (zero downtime)
cd /opt/nearshop
git pull   # or rsync from local
venv/bin/pip install -r requirements.txt  # if deps changed
venv/bin/alembic upgrade head             # if migrations changed
systemctl reload nearshop-api             # graceful restart
```

---

## Resource Usage Estimate (1 vCPU / 2GB RAM)

| Component | RAM |
|-----------|-----|
| 2× Gunicorn/Uvicorn workers | ~200 MB |
| Redis (with 128MB limit) | ~15 MB base |
| Nginx | ~10 MB |
| OS overhead | ~250 MB |
| **Total** | **~475 MB** |

Well within 2GB. Leaves ~1.5GB headroom for traffic spikes.
