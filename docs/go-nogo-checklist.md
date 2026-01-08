# FOLLA Production GO/NO-GO Checklist

**Date**: ____________  
**Engineer**: ____________

---

## ⛔ STOP - Do Not Deploy If Any P0 Fails

---

## P0: Critical Blockers (Must Pass)

### Environment Configuration

- [ ] `NODE_ENV=production` in backend/.env
- [ ] `PAYMEE_ENV=live` in backend/.env  
  ```bash
  grep "PAYMEE_ENV" backend/.env
  # Expected: PAYMEE_ENV=live
  ```
- [ ] Clerk keys are `pk_live_*` and `sk_live_*`
  ```bash
  grep "CLERK.*KEY" backend/.env | grep -v "test"
  # Should show pk_live and sk_live
  ```
- [ ] All URLs use HTTPS
  ```bash
  grep "_URL" backend/.env | grep -v "https://"
  # Should return nothing (all URLs should be https)
  ```
- [ ] CORS allows only production domains
  ```bash
  grep "CORS_ORIGINS" backend/.env
  # Expected: https://follacouffin.tn,https://www.follacouffin.tn
  ```

### Build Verification

- [ ] Backend builds successfully
  ```bash
  cd backend && npm run build && echo "✅ Backend build passed"
  ```
- [ ] Frontend builds successfully  
  ```bash
  cd frontend && npm run build && echo "✅ Frontend build passed"
  ```
- [ ] Type checking passes
  ```bash
  cd backend && npm run typecheck
  cd frontend && npm run typecheck
  ```

### Database

- [ ] Backup created and verified
  ```bash
  # See docs/backup-restore.md for full procedure
  ls -la /var/backups/folla/*.dump
  ```
- [ ] Migrations deployed
  ```bash
  npx prisma migrate deploy
  npx prisma migrate status
  # Should show: "All migrations have been applied"
  ```
- [ ] Restore test passed (on staging DB)

### Webhook Verification

- [ ] Webhook URL is reachable from internet
  ```bash
  curl -I https://api.follacouffin.tn/api/paymee/webhook
  # Expected: HTTP 400 or 405 (endpoint exists)
  ```
- [ ] Webhook rejects missing checksum
  ```bash
  curl -X POST https://api.follacouffin.tn/api/paymee/webhook \
    -H "Content-Type: application/json" \
    -d '{"token":"test","payment_status":true}'
  # Expected: 400 with "check_sum manquant"
  ```
- [ ] Webhook registered in Paymee dashboard

### Health Check

- [ ] Health endpoint returns OK
  ```bash
  curl https://api.follacouffin.tn/health
  # Expected: {"status":"ok",...}
  ```

---

## P1: High Priority (Should Pass)

### Email

- [ ] SPF record configured
  ```bash
  dig TXT follacouffin.tn +short | grep "spf"
  ```
- [ ] DKIM record configured
  ```bash
  dig TXT mail._domainkey.follacouffin.tn +short
  ```
- [ ] Test email received with DKIM pass

### SSL/TLS

- [ ] SSL certificates valid
  ```bash
  echo | openssl s_client -connect follacouffin.tn:443 2>/dev/null | openssl x509 -noout -dates
  ```
- [ ] HSTS header present
  ```bash
  curl -sI https://follacouffin.tn | grep -i "strict-transport"
  ```

### Monitoring

- [ ] Sentry DSN configured
- [ ] Health monitoring set up

---

## 20-Minute Pre-Launch Smoke Test

### Visual Tests (5 min)

1. [ ] Homepage loads correctly
2. [ ] Product images display
3. [ ] Navigation works
4. [ ] Mobile responsive

### Functional Tests (10 min)

1. [ ] Browse products → Add to cart → View cart
2. [ ] Guest checkout form validates correctly
3. [ ] Clerk login works
4. [ ] Admin login → Dashboard loads

### Payment Test (5 min)

1. [ ] Create test order with Paymee
2. [ ] Complete payment (real card, small amount)
3. [ ] Verify webhook received (check logs)
4. [ ] Verify order status = paid
5. [ ] Verify email received

---

## End-to-End Test Record

| Step | Expected | Actual | Pass? |
|------|----------|--------|-------|
| Create order | Order created, status=pending_payment | | [ ] |
| Paymee redirect | Redirects to Paymee payment page | | [ ] |
| Complete payment | Returns to success page | | [ ] |
| Webhook | Order status updates to paid | | [ ] |
| Email | Order confirmation received | | [ ] |
| Admin view | Order visible in admin | | [ ] |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Engineer | | | |
| Product Owner | | | |

---

## Final Verdict

- [ ] **GO** - All P0 passed, P1 accepted
- [ ] **NO-GO** - Blockers identified (list below)

**Blockers (if NO-GO):**
1. 
2. 
3. 

**Scheduled launch time**: ____________
