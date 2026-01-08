# Email Deliverability Setup (Brevo)

This document describes how to configure DNS records for optimal email deliverability.

---

## Prerequisites

- Access to DNS management for `follacouffin.tn`
- Brevo account with verified sender domain
- Access to Brevo SMTP settings

---

## Step 1: Verify Sender Domain in Brevo

1. Log into [Brevo Dashboard](https://app.brevo.com)
2. Go to **Settings** → **Senders & Domains**
3. Click **Add a domain**
4. Enter: `follacouffin.tn`
5. Follow Brevo's verification steps

---

## Step 2: Add DNS Records

### SPF Record (Sender Policy Framework)

Authorizes Brevo to send emails on behalf of your domain.

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | `@` (or leave blank) | `v=spf1 include:spf.brevo.com ~all` | 3600 |

**If you already have an SPF record**, add Brevo's include:

```
# Before:
v=spf1 include:_spf.google.com ~all

# After:
v=spf1 include:_spf.google.com include:spf.brevo.com ~all
```

### DKIM Record (DomainKeys Identified Mail)

Adds cryptographic signature to verify email authenticity.

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | `mail._domainkey` | `k=rsa; p=...` (get from Brevo) | 3600 |

**Get the actual DKIM value from Brevo dashboard** → Settings → Senders & Domains → Your domain → DKIM

### DMARC Record (Domain-based Message Authentication)

Tells receiving servers what to do with unauthenticated emails.

**Start with monitoring mode** (no rejection):

| Type | Host | Value | TTL |
|------|------|-------|-----|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@follacouffin.tn; sp=none; adkim=r; aspf=r` | 3600 |

**After 2-4 weeks of monitoring**, tighten to reject:

```
v=DMARC1; p=reject; rua=mailto:dmarc@follacouffin.tn; sp=reject; adkim=r; aspf=r
```

---

## Step 3: Verify DNS Records

### Using dig command

```bash
# Check SPF
dig TXT follacouffin.tn +short
# Should show: "v=spf1 include:spf.brevo.com ~all"

# Check DKIM
dig TXT mail._domainkey.follacouffin.tn +short
# Should show DKIM key

# Check DMARC
dig TXT _dmarc.follacouffin.tn +short
# Should show: "v=DMARC1; p=none; ..."
```

### Using online tools

- [MXToolbox SPF Check](https://mxtoolbox.com/spf.aspx)
- [DKIM Validator](https://dkimvalidator.com/)
- [DMARC Analyzer](https://www.dmarcanalyzer.com/dmarc/dmarc-record-check/)

---

## Step 4: Test Email Delivery

### Send a Test Email

```bash
# Use the dev email endpoint (development only)
curl -X POST http://localhost:4000/api/dev/email/test \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@gmail.com"}'
```

### Verify Headers in Received Email

1. Open the test email in Gmail
2. Click **⋮** → **Show original**
3. Look for:

```
SPF: PASS
DKIM: PASS
DMARC: PASS
```

If any shows `FAIL`, check your DNS records.

---

## Email Test Checklist

- [ ] SPF record added and verified with `dig`
- [ ] DKIM record added (from Brevo dashboard)
- [ ] DMARC record added
- [ ] Test email sent successfully
- [ ] SPF shows PASS in email headers
- [ ] DKIM shows PASS in email headers
- [ ] Order confirmation email tested with real order

---

## Troubleshooting

### "SPF Soft Fail"

The record uses `~all` (soft fail). This is intentional during setup.
After confirming emails work, you can change to `-all` (hard fail).

### "DKIM Signature Not Found"

1. Verify DKIM record is exactly as provided by Brevo
2. Check for extra spaces or line breaks in the DNS value
3. Wait up to 48 hours for DNS propagation

### Emails Going to Spam

1. Check all three records (SPF, DKIM, DMARC) are PASS
2. Review email content for spam triggers
3. Warm up the sending domain gradually
4. Consider requesting removal from spam lists

---

## Environment Variables

Ensure these are set in production:

```bash
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-key
SMTP_PASS=your-brevo-smtp-password
MAIL_FROM="FollaCouffin <noreply@follacouffin.tn>"
```

**Note**: `MAIL_FROM` must use the verified domain.
