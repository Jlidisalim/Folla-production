# Observability Documentation

This document describes the monitoring, logging, and error tracking setup for the FOLLA platform.

## Overview

| Component | Technology | Purpose |
|-----------|------------|---------|
| Health Checks | Custom Express endpoint | Verify system status & DB connectivity |
| Error Tracking | Sentry | Capture and track errors in production |
| Structured Logging | Pino | JSON logs for debugging and auditing |

---

## Health Endpoint

### URL
```
GET http://localhost:4000/health
```

### Response Format
```json
{
  "status": "ok",
  "timestamp": "2024-12-14T10:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "ok": true,
      "latencyMs": 5
    },
    "memory": {
      "rss": 50000000,
      "heapUsed": 20000000,
      "heapTotal": 40000000
    }
  }
}
```

### HTTP Status Codes
- **200**: All checks pass
- **503**: Critical check failed (DB down)

### Testing Commands

**H1: Test healthy state:**
```bash
curl -i http://localhost:4000/health
```

**Simulate DB failure:**
Stop your database or set an invalid `DATABASE_URL`, then:
```bash
curl -i http://localhost:4000/health
# Expected: HTTP 503 with status: "down"
```

---

## Error Tracking (Sentry)

### Configuration

**Backend (.env):**
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development
```

**Frontend (.env):**
```env
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### Test Endpoints

**H2: Frontend Error Test**
1. Navigate to: `http://localhost:5173/__test__/frontend-error`
2. Click one of the error trigger buttons
3. Check Sentry dashboard for the event

**H3: Backend Error Test**
```bash
# Trigger intentional error
curl http://localhost:4000/__test__/backend-error

# Trigger database error
curl http://localhost:4000/__test__/db-error
```

### Expected Sentry Tags
- `environment`: development/staging/production
- `release`: folla-backend@1.0.0 or folla-frontend@1.0.0
- `requestId`: UUID tracking the request

### Verifying Sentry Events
1. Go to your Sentry dashboard
2. Navigate to Issues
3. Look for:
   - "Intentional test error for Sentry verification" (backend)
   - "Manual test error for Sentry verification" (frontend)
4. Check tags and context for `requestId`

---

## Structured Logging (Pino)

### Configuration

**Environment Variables:**
```env
LOG_LEVEL=info   # debug, info, warn, error
NODE_ENV=development   # For pretty printing
```

### Log Formats

**Development (pretty):**
```
[10:30:00.000] INFO: Server started
    port: 4000
```

**Production (JSON):**
```json
{"level":"info","time":"2024-12-14T10:30:00.000Z","port":4000,"msg":"Server started"}
```

### H4: Testing Logs

**Normal request log:**
```bash
curl http://localhost:4000/products
```
Expected log:
```json
{"level":"info","time":"...","req":{"id":"uuid","method":"GET","url":"/products"},"res":{"statusCode":200},"responseTime":45,"msg":"GET /products 200"}
```

**Error request log:**
```bash
curl http://localhost:4000/__test__/backend-error
```
Expected log:
```json
{"level":"error","time":"...","requestId":"uuid","method":"GET","url":"/__test__/backend-error","status":500,"err":{"type":"Error","message":"Intentional test error...","stack":"..."},"msg":"Request error"}
```

### Redacted Fields (Never Logged)
- `req.headers.authorization`
- `req.headers.cookie`
- `req.headers['x-api-key']`
- `res.headers['set-cookie']`
- `password`
- `token`
- `secret`
- `apiKey`
- `creditCard`
- `ssn`

---

## Audit Test Checklist

### H1: Health Endpoint
- [ ] Call `/health` returns HTTP 200
- [ ] Response includes all required fields
- [ ] No secrets/PII in response
- [ ] HTTP 503 when DB is down

### H2: Frontend Sentry
- [ ] Navigate to `/__test__/frontend-error`
- [ ] Trigger error
- [ ] Event appears in Sentry
- [ ] Correct environment tag

### H3: Backend Sentry
- [ ] Call `/__test__/backend-error`
- [ ] Event appears in Sentry
- [ ] `requestId` tag present
- [ ] Error logged in console

### H4: Logging
- [ ] Normal request produces info log
- [ ] Error request produces error log
- [ ] Logs are structured JSON (in prod)
- [ ] Sensitive fields are redacted

---

## File Tree

```
backend/
├── src/
│   ├── lib/
│   │   ├── logger.ts      # Pino logger configuration
│   │   └── sentry.ts      # Sentry initialization
│   ├── routes/
│   │   └── health.ts      # Health endpoint
│   └── index.ts           # Updated with observability
├── .env.example           # Added SENTRY_DSN, LOG_LEVEL

frontend/
├── src/
│   ├── lib/
│   │   └── sentry.ts      # Sentry initialization
│   ├── pages/
│   │   └── SentryTestPage.tsx  # Test component
│   ├── main.tsx           # Updated with Sentry init
│   └── App.tsx            # Added test route
├── .env.example           # Added VITE_SENTRY_DSN
```

---

## Troubleshooting

### Sentry events not appearing
1. Check DSN is set correctly in `.env`
2. Restart backend/frontend after changing `.env`
3. Check Sentry project matches the DSN
4. Verify network allows outbound requests to sentry.io

### Logs not pretty-printing
- Ensure `NODE_ENV` is not `production`
- All dependencies installed: `npm install`

### Health check shows DB down
1. Verify `DATABASE_URL` is correct
2. Database server is running
3. Network allows connection to DB
