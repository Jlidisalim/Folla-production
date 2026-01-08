import axios from "axios";
import crypto from "crypto";
import { Order } from "@prisma/client";

type PaymeeInitResponse = {
  token: string;
  paymentUrl: string;
  raw: any;
};

type PaymeeWebhookPayload = {
  token: string;
  payment_status: boolean | string | number;
  check_sum?: string;
  [key: string]: any;
};

const env = (process.env.PAYMEE_ENV || "sandbox").toLowerCase();
const mode = (process.env.PAYMEE_MODE || "dynamic").toLowerCase();
const apiKey = process.env.PAYMEE_API_KEY || "";
const webhookUrl = process.env.PAYMEE_WEBHOOK_URL || "";
const returnUrl = process.env.PAYMEE_RETURN_URL || "";
const cancelUrl = process.env.PAYMEE_CANCEL_URL || "";

const baseUrl =
  env === "live" || env === "production"
    ? "https://app.paymee.tn/api/v2"
    : "https://sandbox.paymee.tn/api/v2";

export async function initPaymeePayment(
  order: Order & { client?: any }
): Promise<PaymeeInitResponse> {
  // Validate API key
  if (!apiKey) {
    throw new Error(
      "PAYMEE_API_KEY is missing. Please configure it in your .env file."
    );
  }

  // Validate webhook URL in dynamic mode
  if (mode === "dynamic") {
    if (!webhookUrl) {
      throw new Error(
        "PAYMEE_WEBHOOK_URL is required when PAYMEE_MODE=dynamic. " +
        "Use a public tunnel (ngrok/cloudflare) or switch to PAYMEE_MODE=paylink for development."
      );
    }
    if (webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1")) {
      throw new Error(
        "PAYMEE_WEBHOOK_URL contains localhost. Paymee servers cannot reach localhost URLs. " +
        "Please use a public tunnel (ngrok/cloudflare) or switch to PAYMEE_MODE=paylink for quick dev testing."
      );
    }
  }

  const amount = Number(order.total);
  if (!Number.isFinite(amount)) {
    throw new Error("Montant invalide");
  }

  const [firstName, ...restName] = (order.name || order.client?.name || "")
    .trim()
    .split(" ");
  const lastName = restName.join(" ") || firstName || "Client";

  // Build return/cancel URLs with orderId appended
  const orderIdParam = `orderId=${order.id}`;
  const returnUrlWithOrder = returnUrl
    ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}${orderIdParam}`
    : undefined;
  const cancelUrlWithOrder = cancelUrl
    ? `${cancelUrl}${cancelUrl.includes('?') ? '&' : '?'}${orderIdParam}`
    : undefined;

  const body: any = {
    amount,
    note: `Order #${order.id}`,
    first_name: firstName || "Client",
    last_name: lastName || " ",
    email: order.email || order.client?.email || undefined,
    phone: order.phone || order.client?.phone || undefined,
    webhook_url: webhookUrl,
    return_url: returnUrlWithOrder,
    cancel_url: cancelUrlWithOrder,
    order_id: String(order.id),
  };

  const { data } = await axios.post(`${baseUrl}/payments/create`, body, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${apiKey}`,
    },
  });

  // Debug: Log the full response
  console.log("Paymee API Response:", JSON.stringify(data, null, 2));

  const token = data?.data?.token || data?.token;
  const paymentUrl =
    data?.data?.payment_url || data?.payment_url || data?.paymentUrl;

  if (!token || !paymentUrl) {
    console.error("Missing token or payment_url in response:", data);
    throw new Error("Réponse Paymee invalide (token ou payment_url manquant)");
  }

  return { token, paymentUrl, raw: data };
}

export function verifyPaymeeChecksum(payload: PaymeeWebhookPayload) {
  const token = payload?.token;
  const statusValue = payload?.payment_status;
  const provided = payload?.check_sum;

  if (!token || provided === undefined) return false;
  const statusNormalized =
    typeof statusValue === "boolean"
      ? statusValue
      : String(statusValue).toLowerCase() === "true" ||
      String(statusValue) === "1";

  const computed = crypto
    .createHash("md5")
    .update(`${token}${statusNormalized ? 1 : 0}${apiKey}`)
    .digest("hex");

  return computed === provided;
}
