# Folla-Project

## Paymee card payments

1) Configure environment (see `.env.example`):
   - `PAYMEE_ENV` = `sandbox` or `live`
   - `PAYMEE_API_KEY`, `PAYMEE_WEBHOOK_URL`, `PAYMEE_RETURN_URL`, `PAYMEE_CANCEL_URL`
   - `FRONTEND_URL`, `BACKEND_URL`
2) Run migrations & generate client:
   - `cd backend && npx prisma migrate deploy && npx prisma generate`
3) Start the API: `npm run dev`
4) Webhook endpoint: `POST /api/paymee/webhook` (configure in Paymee dashboard).
5) Card flow endpoints:
   - `POST /orders` with `payment.method = "paymee_card"` (creates order in `pending_payment`)
   - `POST /api/paymee/init` with `{ orderId }` returns `paymentUrl` + `token`
   - `GET /api/paymee/status/:orderId` to poll/confirm status
