# FOLLA Production Deployment Guide

This guide covers deploying FOLLA to production with two options.

---

## Prerequisites

- Domain: `follacouffin.tn` with DNS access
- VPS (2+ GB RAM, 2+ vCPU recommended)
- Docker & Docker Compose installed
- Production credentials for: Clerk, Paymee, Brevo, Sentry

---

## Option A: Docker on VPS (Recommended)

### Step 1: Server Preparation

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install Docker Compose
apt install docker-compose-plugin -y

# Create app directory
mkdir -p /opt/folla
cd /opt/folla
```

### Step 2: Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-repo/folla.git .

# Create production environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit with production values
nano backend/.env
```

**Required backend/.env changes:**
```bash
NODE_ENV=production
FRONTEND_URL=https://follacouffin.tn
BACKEND_URL=https://api.follacouffin.tn
CORS_ORIGINS=https://follacouffin.tn,https://www.follacouffin.tn
PAYMEE_ENV=live
PAYMEE_API_KEY=your_live_api_key
PAYMEE_WEBHOOK_URL=https://api.follacouffin.tn/api/paymee/webhook
CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
```

### Step 3: DNS Configuration

Add these DNS records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | your-server-ip | 3600 |
| A | www | your-server-ip | 3600 |
| A | api | your-server-ip | 3600 |

### Step 4: Get SSL Certificates

```bash
# Create nginx directories
mkdir -p nginx/conf.d nginx/ssl

# First, create a temporary nginx config for ACME challenge
cat > nginx/conf.d/temp.conf << 'EOF'
server {
    listen 80;
    server_name follacouffin.tn www.follacouffin.tn api.follacouffin.tn;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'FOLLA - SSL Setup in progress';
        add_header Content-Type text/plain;
    }
}
EOF

# Start nginx for ACME challenge
docker-compose up -d nginx

# Get certificates
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d follacouffin.tn \
  -d www.follacouffin.tn \
  -d api.follacouffin.tn \
  --email admin@follacouffin.tn \
  --agree-tos \
  --no-eff-email

# Replace temp config with production config
rm nginx/conf.d/temp.conf
# The folla.conf should now work
```

### Step 5: Build Frontend

```bash
cd frontend
npm ci
npm run build
# dist/ folder will be served by nginx
cd ..
```

### Step 6: Database Migration

```bash
# Run migrations
docker-compose run --rm backend npx prisma migrate deploy
docker-compose run --rm backend npx prisma generate
```

### Step 7: Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend
```

### Step 8: Verify Deployment

```bash
# Health check
curl https://api.follacouffin.tn/health

# Test webhook endpoint
curl -X POST https://api.follacouffin.tn/api/paymee/webhook \
  -H "Content-Type: application/json" \
  -d '{"token":"test","payment_status":true,"check_sum":"invalid"}'
# Should return 400 (invalid checksum)
```

---

## Option B: Separate Hosting

### Frontend on Vercel/Netlify

1. Connect Git repository to Vercel
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables:
   - `VITE_API_URL=https://api.follacouffin.tn`
   - `VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx`

### Backend on VPS/Railway

1. Deploy using the Docker setup above (skip nginx frontend portion)
2. Ensure CORS allows Vercel domain (add to `CORS_ORIGINS`)
3. Configure Clerk allowed origins in dashboard

---

## Post-Deployment Tasks

### Configure Paymee Dashboard

1. Log into [Paymee Dashboard](https://app.paymee.tn)
2. Switch to **Production** mode
3. Go to **Settings** → **API Configuration**
4. Set:
   - Webhook URL: `https://api.follacouffin.tn/api/paymee/webhook`
   - Success URL: `https://api.follacouffin.tn/api/paymee/redirect/success`
   - Cancel URL: `https://api.follacouffin.tn/api/paymee/redirect/cancel`
5. Copy **Production API Key** to backend `.env`

### Configure Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Switch to **Production** environment
3. Go to **Settings** → **Domains**
4. Add `follacouffin.tn` and `www.follacouffin.tn`
5. Copy **Production Keys** to both frontend and backend `.env`

### Configure Email DNS

See [docs/email-deliverability.md](./email-deliverability.md) for SPF/DKIM/DMARC setup.

---

## Monitoring

### Logs

```bash
# All logs
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Health Checks

```bash
# Automated health monitoring (add to cron)
*/5 * * * * curl -sf https://api.follacouffin.tn/health || echo "FOLLA DOWN" | mail -s "Alert" admin@follacouffin.tn
```

---

## Troubleshooting

### Container won't start

```bash
docker-compose logs backend
# Check for config errors
```

### Database connection failed

```bash
# Test database connectivity
docker-compose exec postgres psql -U folla_user -d folla_prod -c "SELECT 1;"
```

### SSL certificate renewal

```bash
# Manual renewal
docker-compose run --rm certbot renew

# Check certificate expiry
openssl s_client -connect follacouffin.tn:443 2>/dev/null | openssl x509 -noout -dates
```
