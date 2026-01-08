# FOLLA Production Deployment: Render.com

Complete step-by-step guide for deploying FOLLA to **Render.com**:
- **PostgreSQL Database** → Render PostgreSQL
- **Backend** (Node/Express) → Render Web Service
- **Frontend** (React/Vite) → Render Static Site (or Vercel)

---

## Prerequisites

Before starting:
1. **GitHub account** with your FOLLA code pushed
2. **Render.com account** (sign up free at [render.com](https://render.com))
3. Production credentials ready: Clerk, Paymee, Brevo (SMTP)

---

## Step 1: Push Code to GitHub

If not already on GitHub:

```bash
cd /Users/welcom/Documents/FOLLA

# Initialize git (if needed)
git init

# Create .gitignore if missing
cat >> .gitignore << 'EOF'
node_modules/
.env
.env.local
dist/
.DS_Store
EOF

# Add and commit
git add .
git commit -m "Production ready"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/folla.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create PostgreSQL Database

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `folla-db` |
| **Database** | `folla` |
| **User** | `folla_user` |
| **Region** | Choose closest to your users |
| **Plan** | Free (or paid for production) |

4. Click **"Create Database"**
5. Wait for provisioning (~1-2 minutes)
6. **Copy the "Internal Database URL"** - you'll need this for the backend

> [!IMPORTANT]
> The Internal URL looks like:
> ```
> postgresql://folla_user:PASSWORD@dpg-xxx.render.com/folla
> ```
> Use the **Internal URL** (not External) for best performance.

---

## Step 3: Deploy Backend (Web Service)

1. Click **"New +"** → **"Web Service"**
2. Connect your **GitHub account** if prompted
3. Select your **folla** repository
4. Configure:

| Field | Value |
|-------|-------|
| **Name** | `folla-backend` |
| **Region** | Same as database |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm ci && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && npm start` |
| **Plan** | Free (or Starter for production) |

5. Click **"Create Web Service"** (don't worry about env vars yet)

### 3.1: Add Environment Variables

After creation, go to **"Environment"** tab → **"Add Environment Variable"**:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://folla_user:xxx@dpg-xxx.render.com/folla` (Internal URL from Step 2) |
| `PORT` | `10000` |
| `CORS_ORIGINS` | `https://folla-frontend.onrender.com,https://follacouffin.tn` |
| `FRONTEND_URL` | `https://folla-frontend.onrender.com` |
| `BACKEND_URL` | `https://folla-backend.onrender.com` |
| `CLERK_PUBLISHABLE_KEY` | `pk_live_...` |
| `CLERK_SECRET_KEY` | `sk_live_...` |
| `PAYMEE_MODE` | `dynamic` |
| `PAYMEE_ENV` | `live` |
| `PAYMEE_API_KEY` | `your_live_api_key` |
| `PAYMEE_WEBHOOK_URL` | `https://folla-backend.onrender.com/api/paymee/webhook` |
| `PAYMEE_RETURN_URL` | `https://folla-backend.onrender.com/api/paymee/redirect/success` |
| `PAYMEE_CANCEL_URL` | `https://folla-backend.onrender.com/api/paymee/redirect/cancel` |
| `SMTP_HOST` | `smtp-relay.brevo.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your_brevo_user` |
| `SMTP_PASS` | `your_brevo_password` |
| `MAIL_FROM` | `FollaCouffin <noreply@follacouffin.tn>` |
| `ADMIN_EMAIL` | `admin@follacouffin.tn` |

6. Click **"Save Changes"** - this triggers a redeploy

### 3.2: Verify Backend Deployment

Wait for deploy to complete, then test:

```bash
curl https://folla-backend.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "checks": { "database": { "ok": true } }
}
```

---

## Step 4: Deploy Frontend (Static Site)

1. Click **"New +"** → **"Static Site"**
2. Select your **folla** repository
3. Configure:

| Field | Value |
|-------|-------|
| **Name** | `folla-frontend` |
| **Branch** | `main` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm ci && npm run build` |
| **Publish Directory** | `dist` |

4. Add Environment Variables **BEFORE first build**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://folla-backend.onrender.com` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` |

5. Click **"Create Static Site"**

> [!WARNING]
> **Vite env vars are build-time only!**
> If you change them, you must trigger a new deploy:
> Dashboard → Your site → **"Manual Deploy"** → **"Deploy latest commit"**

---

## Step 5: Configure Clerk (Production)

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Switch to **Production** environment (top dropdown)
3. Go to **Settings** → **Domains**
4. Add allowed domains:

```
https://folla-frontend.onrender.com
https://follacouffin.tn
https://www.follacouffin.tn
```

5. Go to **Settings** → **Paths** → Set redirect URLs:

```
https://folla-frontend.onrender.com/*
https://follacouffin.tn/*
```

6. Copy **Production API Keys** (`pk_live_*` and `sk_live_*`) to your env vars

---

## Step 6: Configure Paymee (Production)

1. Go to [app.paymee.tn](https://app.paymee.tn)
2. Switch to **Production/Live** mode
3. Go to **Settings** → **API Configuration**
4. Set:

| Field | Value |
|-------|-------|
| Webhook URL | `https://folla-backend.onrender.com/api/paymee/webhook` |
| Success URL | `https://folla-backend.onrender.com/api/paymee/redirect/success` |
| Cancel URL | `https://folla-backend.onrender.com/api/paymee/redirect/cancel` |

5. Copy **Production API Key** to backend env vars

---

## Step 7: Custom Domain (Optional)

### Backend Custom Domain
1. Go to your backend service → **Settings** → **Custom Domains**
2. Add: `api.follacouffin.tn`
3. Add DNS records at your registrar:

```
Type: CNAME
Name: api
Value: folla-backend.onrender.com
```

### Frontend Custom Domain
1. Go to your static site → **Settings** → **Custom Domains**
2. Add: `follacouffin.tn` and `www.follacouffin.tn`
3. Add DNS records:

```
Type: CNAME
Name: @
Value: folla-frontend.onrender.com

Type: CNAME
Name: www
Value: folla-frontend.onrender.com
```

---

## Final Verification Checklist

### ✅ Backend Health
```bash
curl https://folla-backend.onrender.com/health
# Should return: {"status":"ok", "checks":{"database":{"ok":true}}}
```

### ✅ Database Connected
```bash
# If health check shows database.ok = true, you're good!
```

### ✅ Frontend Loads
- Open `https://folla-frontend.onrender.com`
- Check DevTools → Network: API calls should go to backend
- No CORS errors in console

### ✅ Clerk Authentication
- Click Sign In → Complete flow
- Should redirect back to your app
- Protected routes should work

### ✅ Paymee Payment
- Add items to cart → Checkout → Pay
- Complete payment on Paymee
- Verify order status updates to `pending`

### ✅ CORS Check
```bash
curl -I -X OPTIONS "https://folla-backend.onrender.com/products" \
  -H "Origin: https://folla-frontend.onrender.com" \
  -H "Access-Control-Request-Method: GET"
# Should include: Access-Control-Allow-Origin: https://folla-frontend.onrender.com
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| **Build fails** | Missing dependencies | Check `package.json` has all deps |
| **Prisma error** | Client not generated | Ensure build command includes `npx prisma generate` |
| **502 Bad Gateway** | App crashed | Check Logs tab for errors |
| **CORS error** | Wrong origin | Add frontend URL to `CORS_ORIGINS` |
| **Database timeout** | Using External URL | Use **Internal** Database URL |
| **Env vars not working** | Vite build-time vars | Redeploy after changing `VITE_*` vars |
| **Cold starts slow** | Free tier sleeps | Upgrade to Starter plan ($7/mo) |

---

## Render Free Tier Limits

| Resource | Free Limit |
|----------|------------|
| Web Services | Spin down after 15min inactivity |
| PostgreSQL | 1GB storage, expires after 90 days |
| Static Sites | Unlimited |
| Bandwidth | 100GB/month |

> [!TIP]
> For production, use **Starter** plan ($7/mo for web service) to avoid cold starts.

---

## Quick Reference

| Service | URL |
|---------|-----|
| Backend | `https://folla-backend.onrender.com` |
| Frontend | `https://folla-frontend.onrender.com` |
| Database | Internal URL in Render dashboard |
| Health Check | `https://folla-backend.onrender.com/health` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  RENDER.COM                                                  │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │ Static Site         │    │ Web Service         │         │
│  │ (Frontend)          │───▶│ (Backend)           │         │
│  │ folla-frontend      │    │ folla-backend       │         │
│  └─────────────────────┘    └──────────┬──────────┘         │
│                                        │                     │
│                                        ▼                     │
│                             ┌─────────────────────┐         │
│                             │ PostgreSQL          │         │
│                             │ folla-db            │         │
│                             └─────────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```
