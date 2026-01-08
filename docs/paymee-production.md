# Paymee Production Configuration

This document describes how to configure Paymee for live payments.

---

## Prerequisites

- Paymee merchant account approved for production
- Backend deployed with HTTPS
- Webhook endpoint accessible from internet

---

## Step 1: Switch to Production Environment

1. Log into [Paymee Dashboard](https://app.paymee.tn)
2. Click your profile icon → **Switch to Production**
3. Verify you're in production mode (banner should NOT say "Sandbox")

---

## Step 2: Get Production API Key

1. Go to **Settings** → **API Keys**
2. Copy the **Production API Key**
3. Add to backend `.env`:
   ```
   PAYMEE_API_KEY=your_production_api_key
   PAYMEE_ENV=live
   ```

---

## Step 3: Configure Webhook URL

1. Go to **Settings** → **Webhooks** (or **API Configuration**)
2. Set Webhook URL:
   ```
   https://api.follacouffin.tn/api/paymee/webhook
   ```
3. Save changes

### Verify Webhook is Reachable

```bash
# From any computer with internet access:
curl -X POST https://api.follacouffin.tn/api/paymee/webhook \
  -H "Content-Type: application/json" \
  -d '{"token":"test"}'

# Expected: 400 error (missing fields is OK - endpoint exists)
```

---

## Step 4: Configure Return URLs

Add these URLs in Paymee dashboard or ensure they're in your `.env`:

| URL Type | Value |
|----------|-------|
| Success URL | `https://api.follacouffin.tn/api/paymee/redirect/success` |
| Cancel URL | `https://api.follacouffin.tn/api/paymee/redirect/cancel` |

In backend `.env`:
```
PAYMEE_RETURN_URL=https://api.follacouffin.tn/api/paymee/redirect/success
PAYMEE_CANCEL_URL=https://api.follacouffin.tn/api/paymee/redirect/cancel
```

---

## Step 5: Test Live Payment

⚠️ **Use a real card with a small amount (1-5 TND)**

1. Create a test order on your live site
2. Select card payment
3. Complete payment on Paymee
4. Verify:
   - [ ] Redirected back to success page
   - [ ] Order status changed to `paid`
   - [ ] Email received
   - [ ] In backend logs: `Paymee webhook checksum verified`

---

## Webhook Security

Your webhook is secured by:

1. **Checksum validation**: Every webhook includes a `check_sum` that proves it came from Paymee
2. **HTTPS only**: Webhook URL must be HTTPS
3. **Production rejection**: Missing checksum is rejected with 400 error

### Checksum Calculation

Paymee calculates: `MD5(token + payment_status_as_int + api_key)`

```javascript
// Example verification (already implemented in paymee.service.ts)
const computed = crypto
  .createHash("md5")
  .update(`${token}${statusNormalized ? 1 : 0}${apiKey}`)
  .digest("hex");
return computed === provided;
```

---

## Troubleshooting

### "Webhook not received"

1. Check URL is HTTPS and publicly accessible
2. Verify URL is correctly saved in Paymee dashboard
3. Check backend logs for incoming requests
4. Ensure firewall allows POST requests

### "Checksum invalid"

1. Verify API key in `.env` matches production key (not sandbox)
2. Check for extra whitespace in API key
3. Verify `PAYMEE_ENV=live`

### "Order stuck in pending_payment"

1. Check webhook logs for errors
2. Verify payment was completed on Paymee side
3. Manual recovery:
   ```bash
   # Check order status in database
   npx prisma studio
   # Find order and check providerPaymentId
   ```

---

## Reconciliation

A background job runs every 15 minutes to:
- Find orders stuck in `pending_payment` > 30 minutes
- Mark them as `expired`
- Restore stock automatically

This handles cases where webhooks fail to deliver.
