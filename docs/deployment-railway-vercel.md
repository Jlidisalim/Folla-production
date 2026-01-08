# FOLLA Production Deployment: Railway + Vercel

Complete step-by-step guide for deploying FOLLA with:
- **Frontend** (React/Vite) → **Vercel**
- **Backend** (Node/Express) + **PostgreSQL** → **Railway**

---

## Table of Contents

1. [Railway: Backend + PostgreSQL](#1-railway-backend--postgresql)
2. [Environment Variables (Railway)](#2-environment-variables-railway)
3. [Backend Code Changes](#3-backend-code-changes)
4. [Vercel: Frontend Deployment](#4-vercel-frontend-deployment)
5. [Clerk Production Setup](#5-clerk-production-setup)
6. [Paymee Webhook Configuration](#6-paymee-webhook-configuration)
7. [Final Verification Checklist](#7-final-verification-checklist)
8. [Common Issues & Fixes](#8-common-issues--fixes)

---

## 1. Railway: Backend + PostgreSQL

### Step 1.1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"** → **"Empty Project"**
3. Name it: `folla-production`

### Step 1.2: Add PostgreSQL Database

1. Inside your project, click **"+ New"** → **"Database"** → **"Add PostgreSQL"**
2. Wait for provisioning (~30 seconds)
3. Click the PostgreSQL service → **"Variables"** tab
4. **Copy `DATABASE_URL`** – you'll need this for the backend

> [!IMPORTANT]
> The `DATABASE_URL` format:
> ```
> postgresql://postgres:PASSWORD@HOST.railway.internal:5432/railway
> ```
> Railway provides an internal hostname for services within the same project.

### Step 1.3: Add Backend Service

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your FOLLA repository
3. Railway will detect it's a Node.js project

### Step 1.4: Configure Service Settings

Click the backend service → **"Settings"** tab:

| Setting | Value |
|---------|-------|
| **Root Directory** | `/backend` (for monorepo) |
| **Build Command** | `npm ci && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm start` |
| **Watch Paths** | `/backend/**` |

> [!TIP]
> For separate repos, leave Root Directory empty.

### Step 1.5: Generate Public Domain

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. You'll get: `folla-backend-production.up.railway.app`
4. (Optional) Add custom domain: `api.follacouffin.tn`

---

## 2. Environment Variables (Railway)

Go to your backend service → **"Variables"** tab → Add these:

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_ENV` | `production` | **Required** |
| `PORT` | `${{PORT}}` | Railway injects this automatically |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Reference PostgreSQL service variable |
| `CORS_ORIGINS` | `https://folla.vercel.app,https://folla-*.vercel.app` | Include preview URLs |
| `FRONTEND_URL` | `https://folla.vercel.app` | Your Vercel production domain |
| `BACKEND_URL` | `https://folla-backend-production.up.railway.app` | Your Railway domain |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` | From Clerk dashboard (production) |
| `CLERK_SECRET_KEY` | `sk_live_...` | From Clerk dashboard (production) |
| `PAYMEE_MODE` | `dynamic` | Required for webhooks |
| `PAYMEE_ENV` | `live` | **Must be `live` for production** |
| `PAYMEE_API_KEY` | `your_live_api_key` | From Paymee dashboard |
| `PAYMEE_WEBHOOK_URL` | `https://folla-backend-production.up.railway.app/api/paymee/webhook` | Must be HTTPS |
| `PAYMEE_RETURN_URL` | `https://folla-backend-production.up.railway.app/api/paymee/redirect/success` | Success redirect |
| `PAYMEE_CANCEL_URL` | `https://folla-backend-production.up.railway.app/api/paymee/redirect/cancel` | Cancel redirect |
| `SMTP_HOST` | `smtp-relay.brevo.com` | Brevo SMTP |
| `SMTP_PORT` | `587` | TLS port |
| `SMTP_USER` | `your_brevo_user` | From Brevo |
| `SMTP_PASS` | `your_brevo_password` | From Brevo |
| `MAIL_FROM` | `"FollaCouffin <noreply@follacouffin.tn>"` | Sender address |
| `ADMIN_EMAIL` | `admin@follacouffin.tn` | Admin notifications |
| `SENTRY_DSN` | `https://xxx@xxx.ingest.sentry.io/xxx` | Optional but recommended |
| `LOG_LEVEL` | `info` | Production log level |

> [!CAUTION]
> **Never commit secrets to Git!**
> - Ensure `.env` is in `.gitignore`
> - Use Railway Variables for all secrets
> - Use `pk_live_*` and `sk_live_*` Clerk keys (NOT test keys!)

---

## 3. Backend Code Changes

Your backend already has most production-ready code. Verify these are in place:

### 3.1: Trust Proxy (Already configured ✅)

In `backend/src/index.ts`, add before other middleware if missing:

```typescript
// Trust Railway/Vercel proxy for HTTPS
app.set("trust proxy", 1);
```

### 3.2: Dynamic PORT Binding (Already configured ✅)

```typescript
const PORT = Number(process.env.PORT || 4000);
// ...
app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server started");
});
```

### 3.3: CORS Configuration (Already configured ✅)

```typescript
const origins =
  process.env.CORS_ORIGINS
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ??
  [process.env.FRONTEND_URL || "http://localhost:8080"];

app.use(
  cors({
    origin: origins,
    credentials: true,
  })
);
```

### 3.4: Health Endpoint (Already configured ✅)

Your `/health` endpoint already returns:
```json
{
  "status": "ok",
  "timestamp": "2026-01-08T15:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": { "ok": true, "latencyMs": 5 },
    "memory": { "rss": 50000000, "heapUsed": 25000000, "heapTotal": 40000000 }
  }
}
```

### 3.5: Package.json Scripts

Update `backend/package.json` scripts for production:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy",
    "postinstall": "prisma generate"
  }
}
```

> [!NOTE]
> **Where to run Prisma commands:**
> - `prisma generate` → **Build step** (via `postinstall` or build command)
> - `prisma migrate deploy` → **Start command** (ensures migrations run on each deploy)

---

## 4. Vercel: Frontend Deployment

### Step 4.1: Import Project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **"Add New Project"** → **"Import Git Repository"**
3. Select your FOLLA repository
4. **Configure Project:**

| Setting | Value |
|---------|-------|
| **Framework Preset** | Vite |
| **Root Directory** | `frontend` (for monorepo) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm ci` |

### Step 4.2: Set Environment Variables

Go to **Settings** → **Environment Variables**:

| Variable | Value | Environments |
|----------|-------|--------------|
| `VITE_API_URL` | `https://folla-backend-production.up.railway.app` | Production |
| `VITE_API_URL` | `https://folla-backend-preview.up.railway.app` | Preview (optional) |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Production |

> [!WARNING]
> **Vite env vars are injected at BUILD TIME!**
> After adding or changing env vars, you MUST redeploy:
> ```bash
> # Via Vercel CLI
> vercel --prod
> 
> # Or trigger from dashboard
> # Settings → Deployments → Redeploy
> ```

### Step 4.3: Verify API URL in Frontend

Your `frontend/src/lib/api.ts` already handles this:

```typescript
const BASE_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4002";

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});
```

### Step 4.4: Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add: `follacouffin.tn` and `www.follacouffin.tn`
3. Configure DNS at your registrar:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

---

## 5. Clerk Production Setup

### Step 5.1: Switch to Production Instance

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Click your app → **"Production"** tab (top)
3. This creates a separate production environment

### Step 5.2: Configure Allowed Origins

Go to **Settings** → **Domains**:

| Domain | Notes |
|--------|-------|
| `https://folla.vercel.app` | Your Vercel domain |
| `https://follacouffin.tn` | Custom domain |
| `https://www.follacouffin.tn` | www variant |
| `https://*.vercel.app` | Preview deployments (optional) |

### Step 5.3: Configure Redirect URLs

Go to **Settings** → **Sign-in** and **Sign-up**:

```
Allowed redirect URLs:
- https://folla.vercel.app/*
- https://follacouffin.tn/*
- https://www.follacouffin.tn/*
```

### Step 5.4: Copy Production Keys

Go to **API Keys**:

- Copy **Publishable Key** (`pk_live_...`) → Use in both frontend and backend
- Copy **Secret Key** (`sk_live_...`) → Use in backend ONLY

> [!IMPORTANT]
> **Cookie/JWT Cross-Domain Configuration:**
> 
> For `credentials: true` to work:
> 1. Backend must be on same parent domain (e.g., `api.follacouffin.tn`)
> 2. OR use Clerk's JWT verification (which you're already doing)
> 
> Since Railway gives you a different domain (`*.railway.app`), cookies won't work across domains. Your current JWT-based auth is correct!

---

## 6. Paymee Webhook Configuration

### Step 6.1: Configure Paymee Dashboard

1. Log into [Paymee Dashboard](https://app.paymee.tn)
2. Switch to **Production/Live** mode
3. Go to **Settings** → **API Configuration**
4. Set:

| Field | Value |
|-------|-------|
| **Webhook URL** | `https://folla-backend-production.up.railway.app/api/paymee/webhook` |
| **Success URL** | `https://folla-backend-production.up.railway.app/api/paymee/redirect/success` |
| **Cancel URL** | `https://folla-backend-production.up.railway.app/api/paymee/redirect/cancel` |

5. Copy **Production API Key** → Add to Railway env vars

### Step 6.2: Verify Webhook Logging

Your webhook handler should log incoming requests. Check Railway logs:

```bash
# Railway CLI
railway logs -f

# Look for:
# [INFO] Paymee webhook received: { token: "xxx", payment_status: true }
```

### Step 6.3: Test Webhook Manually

```bash
# From your local machine (should return 400 - invalid checksum)
curl -X POST "https://folla-backend-production.up.railway.app/api/paymee/webhook" \
  -H "Content-Type: application/json" \
  -d '{"token":"test","payment_status":true,"check_sum":"invalid"}'
```

Expected response: `400 Bad Request` (checksum validation failed = webhook works!)

### Step 6.4: Webhook Verification Checklist

- [ ] Webhook URL is HTTPS (required by Paymee)
- [ ] Endpoint is publicly accessible (no auth required)
- [ ] Checksum validation is enabled
- [ ] Order status updates from `pending_payment` → `pending` on success
- [ ] Payment reconciliation job runs (auto-cancels stale payments)

---

## 7. Final Verification Checklist

### Backend Health

```bash
# Health check returns 200
curl -s "https://folla-backend-production.up.railway.app/health" | jq

# Expected:
# {
#   "status": "ok",
#   "version": "1.0.0",
#   "checks": { "database": { "ok": true } }
# }
```

### Database Connection

```bash
# If health check shows database.ok = true, you're connected!
# Or test via Railway shell:
railway run npx prisma db pull
```

### Prisma Migrations

```bash
# Verify migrations are applied
railway logs | grep "prisma migrate deploy"

# Should show: "X migrations applied successfully"
```

### Frontend → Backend Connection

1. Open `https://folla.vercel.app` in browser
2. Open DevTools → Network tab
3. Verify API calls go to your Railway backend
4. No CORS errors in console

### Clerk Authentication

1. Click "Sign In" on frontend
2. Complete sign-in flow
3. Verify redirect back to your app works
4. Check that authenticated API calls succeed

### Paymee Payment Flow

1. Add items to cart → Checkout
2. Select Paymee payment
3. Complete payment on Paymee gateway
4. Verify:
   - [ ] Redirect back to success page
   - [ ] Order status changes to `pending` (not `pending_payment`)
   - [ ] Order confirmation email sent

### CORS Verification

```bash
# Should return CORS headers for your domain
curl -I -X OPTIONS "https://folla-backend-production.up.railway.app/products" \
  -H "Origin: https://folla.vercel.app" \
  -H "Access-Control-Request-Method: GET"

# Check for:
# Access-Control-Allow-Origin: https://folla.vercel.app
# Access-Control-Allow-Credentials: true
```

---

## 8. Common Issues & Fixes

### Railway Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **Build fails: "prisma generate" not found** | Prisma not in dependencies | Move `prisma` from devDependencies to dependencies |
| **Port binding error** | Hardcoded port | Use `process.env.PORT` |
| **Database connection timeout** | Wrong DATABASE_URL | Use `${{Postgres.DATABASE_URL}}` reference |
| **Node version mismatch** | Railway uses latest | Add `engines` to package.json: `"engines": { "node": "18.x" }` |
| **Build cache issues** | Stale dependencies | Settings → Restart with cleared cache |

### Prisma Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Prisma Client not generated"** | Missing generate step | Add to build: `npx prisma generate` |
| **"Migration failed"** | DB schema drift | Railway shell: `npx prisma migrate reset` (⚠️ destroys data) |
| **Connection pool exhausted** | Too many connections | Add to DATABASE_URL: `?connection_limit=5` |

### Vercel Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **API calls fail** | Wrong VITE_API_URL | Check env vars, redeploy after changes |
| **CORS error** | Backend not allowing origin | Add Vercel domain to `CORS_ORIGINS` |
| **Build fails** | Missing env vars | All `VITE_*` vars must be set before build |
| **Preview deployments fail** | Different env vars needed | Set preview-specific env vars |

### Clerk Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Invalid API Key"** | Using test key in production | Use `pk_live_*` and `sk_live_*` keys |
| **Redirect loop** | Wrong redirect URLs | Add all domains to allowed redirects |
| **CORS on auth** | Domain not in allowed list | Add domain to Clerk dashboard |

---

## Quick Reference: Final Commands

```bash
# Railway CLI
npm i -g @railway/cli
railway login
railway link  # Link to project

# Deploy
railway up

# View logs
railway logs -f

# Run command in container
railway run npx prisma studio

# Vercel CLI
npm i -g vercel
vercel login
vercel link

# Deploy to production
vercel --prod

# View logs
vercel logs
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Frontend (React/Vite)                                   │    │
│  │  - folla.vercel.app                                      │    │
│  │  - VITE_API_URL → Railway backend                        │    │
│  │  - VITE_CLERK_PUBLISHABLE_KEY                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS API calls
                              │ + Clerk JWT tokens
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RAILWAY                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Backend (Node/Express)                                  │    │
│  │  - folla-backend-production.up.railway.app               │    │
│  │  - PORT from Railway                                     │    │
│  │  - Clerk JWT validation                                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              │ Internal connection               │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PostgreSQL                                              │    │
│  │  - postgres://...@railway.internal:5432/railway          │    │
│  │  - Prisma ORM                                            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Webhooks
                              │
┌─────────────────────────────────────────────────────────────────┐
│  EXTERNAL SERVICES                                               │
│  - Clerk (auth)                                                  │
│  - Paymee (payments) → /api/paymee/webhook                      │
│  - Brevo (email)                                                 │
│  - Sentry (monitoring)                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

> **Next Steps:**
> 1. Create Railway project and add PostgreSQL
> 2. Deploy backend service with env vars
> 3. Import frontend to Vercel
> 4. Configure Clerk production domains
> 5. Set up Paymee webhook URL
> 6. Run verification checklist
