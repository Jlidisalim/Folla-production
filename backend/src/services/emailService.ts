/**
 * Email Service - Nodemailer SMTP Implementation
 *
 * Uses Nodemailer with Brevo SMTP for order confirmation
 * and admin notification emails. All content is in French.
 */

import { PrismaClient } from "@prisma/client";

// Mailer
import { sendEmail, isMailerConfigured, getMailFrom } from "../lib/mailer";

// Email Templates
import {
  buildOrderConfirmationHtml,
  buildOrderConfirmationText,
} from "../emails/orderConfirmation";
import {
  buildAdminNewOrderHtml,
  buildAdminNewOrderText,
} from "../emails/adminNewOrder";
import {
  buildLoginAlertHtml,
  buildLoginAlertText,
  type LoginAlertParams,
} from "../emails/loginAlert";

// ============================================================================
// Types
// ============================================================================

interface OrderItemWithProduct {
  id: number;
  quantity: number;
  price: number;
  variant: string | null;
  color: string | null;
  size: string | null;
  attributes: any; // Compatible with Prisma's JsonValue
  product: {
    id: number;
    title: string;
    images: string[];
    shippingPrice?: number;
  };
}

export interface OrderWithItems {
  id: number;
  total: number;
  status: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  region: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  createdAt: Date;
  items: OrderItemWithProduct[];
}

export interface EmailResult {
  success: boolean;
  errors: string[];
}

// ============================================================================
// Configuration
// ============================================================================

const ADMIN_EMAIL = process.env.ADMIN_ORDER_EMAIL || process.env.ADMIN_EMAIL || "admin@folla.tn";

// Feature flags - control which emails are sent
const SEND_ORDER_EMAIL = process.env.SEND_ORDER_EMAIL !== "false";
const SEND_ADMIN_ORDER_EMAIL = process.env.SEND_ADMIN_ORDER_EMAIL !== "false";
const SEND_LOGIN_EMAIL = process.env.SEND_LOGIN_EMAIL !== "false";

// Default shipping values (fallback if database unavailable)
const DEFAULT_FREE_SHIPPING_THRESHOLD = 200;
const DEFAULT_SHIPPING_FEE = 8;

/**
 * Get shipping settings from database (ShopSettings table)
 */
async function getShippingSettings(): Promise<{ threshold: number; fee: number }> {
  try {
    const settings = await prisma.shopSettings.findUnique({
      where: { id: 1 },
    });

    if (settings) {
      return {
        threshold: settings.freeShippingThresholdDt,
        fee: settings.defaultShippingFeeDt,
      };
    }
  } catch (err) {
    console.warn("[email] Failed to load ShopSettings, using defaults:", err);
  }

  return {
    threshold: DEFAULT_FREE_SHIPPING_THRESHOLD,
    fee: DEFAULT_SHIPPING_FEE,
  };
}

/**
 * Calculate shipping fee for an order based on subtotal and settings
 * Returns 0 if subtotal >= freeShippingThreshold, otherwise returns defaultShippingFee
 */
async function calculateShippingFee(subtotal: number): Promise<number> {
  const { threshold, fee } = await getShippingSettings();

  if (subtotal >= threshold) {
    console.log(`[email] Free shipping applied (subtotal ${subtotal} >= threshold ${threshold})`);
    return 0;
  }

  return fee;
}

const prisma = new PrismaClient();

// ============================================================================
// Email Sending Functions
// ============================================================================

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(
  order: OrderWithItems
): Promise<EmailResult> {
  // Check feature flag
  if (!SEND_ORDER_EMAIL) {
    console.log(`[email] ℹ️ Order email disabled (SEND_ORDER_EMAIL=false)`);
    return { success: true, errors: [] };
  }

  if (!isMailerConfigured()) {
    const msg = "SMTP not configured (missing credentials)";
    console.warn(`[email] ⚠️ ${msg}`);
    return { success: false, errors: [msg] };
  }

  if (!order.email) {
    const msg = `Order #${order.id} has no customer email`;
    console.warn(`[email] ⚠️ ${msg}`);
    return { success: false, errors: [msg] };
  }

  try {
    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Derive shipping fee from the stored order total for consistency
    // (order.total was calculated at order creation time with the shipping that was charged)
    const shippingFee = Math.max(0, order.total - subtotal);

    const html = buildOrderConfirmationHtml({ order, shippingFee });
    const text = buildOrderConfirmationText({ order, shippingFee });
    const subject = `Confirmation de votre commande #${order.id} - FOLLA`;

    console.log(`[email] Order #${order.id} - Subtotal: ${subtotal} TND, Shipping: ${shippingFee === 0 ? 'GRATUIT' : shippingFee + ' TND'}`);

    await sendEmail({
      to: order.email,
      subject,
      html,
      text,
    });

    console.log(
      `[email] ✅ Sent order confirmation for order #${order.id} to ${order.email}`
    );
    return { success: true, errors: [] };
  } catch (err: any) {
    const msg = `Failed to send customer email: ${err.message}`;
    console.error(`[email] ❌ ${msg}`);
    return { success: false, errors: [msg] };
  }
}

/**
 * Send new order notification to admin
 */
export async function sendAdminNewOrderEmail(
  order: OrderWithItems,
  adminEmail?: string
): Promise<EmailResult> {
  // Check feature flag
  if (!SEND_ADMIN_ORDER_EMAIL) {
    console.log(`[email] ℹ️ Admin email disabled (SEND_ADMIN_ORDER_EMAIL=false)`);
    return { success: true, errors: [] };
  }

  const to = adminEmail || ADMIN_EMAIL;

  if (!isMailerConfigured()) {
    const msg = "SMTP not configured (missing credentials)";
    console.warn(`[email] ⚠️ ${msg}`);
    return { success: false, errors: [msg] };
  }

  try {
    // Calculate subtotal from items
    const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Derive shipping fee from the stored order total for consistency
    // (order.total was calculated at order creation time with the shipping that was charged)
    const shippingFee = Math.max(0, order.total - subtotal);

    const html = buildAdminNewOrderHtml({ order, shippingFee });
    const text = buildAdminNewOrderText({ order, shippingFee });
    const subject = `🛒 Nouvelle commande #${order.id} - ${order.total.toFixed(2)} TND`;

    await sendEmail({
      to,
      subject,
      html,
      text,
    });

    console.log(
      `[email] ✅ Sent admin notification for order #${order.id} to ${to}`
    );
    return { success: true, errors: [] };
  } catch (err: any) {
    const msg = `Failed to send admin email: ${err.message}`;
    console.error(`[email] ❌ ${msg}`);
    return { success: false, errors: [msg] };
  }
}

/**
 * Send login alert email to user
 */
export async function sendLoginAlertEmail(
  params: LoginAlertParams
): Promise<EmailResult> {
  // Check feature flag
  if (!SEND_LOGIN_EMAIL) {
    console.log(`[email] ℹ️ Login email disabled (SEND_LOGIN_EMAIL=false)`);
    return { success: true, errors: [] };
  }

  if (!isMailerConfigured()) {
    const msg = "SMTP not configured (missing credentials)";
    console.warn(`[email] ⚠️ ${msg}`);
    return { success: false, errors: [msg] };
  }

  try {
    const html = buildLoginAlertHtml(params);
    const text = buildLoginAlertText(params);
    const subject = "🔐 Alerte de connexion - FOLLA";

    await sendEmail({
      to: params.email,
      subject,
      html,
      text,
    });

    console.log(`[email] ✅ Sent login alert to ${params.email}`);
    return { success: true, errors: [] };
  } catch (err: any) {
    const msg = `Failed to send login alert: ${err.message}`;
    console.error(`[email] ❌ ${msg}`);
    return { success: false, errors: [msg] };
  }
}

// ============================================================================
// Main Function: Send Both Order Emails
// ============================================================================

export async function sendOrderEmails(orderId: number): Promise<EmailResult> {
  const errors: string[] = [];

  // Check configuration first
  if (!isMailerConfigured()) {
    const msg = "SMTP not configured (missing credentials)";
    console.warn(`[email] ⚠️ ${msg}`);
    return { success: false, errors: [msg] };
  }

  // Load order with items
  let order: OrderWithItems | null;
  try {
    order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
  } catch (err: any) {
    const msg = `Failed to load order #${orderId}: ${err.message}`;
    console.error(`[email] ❌ ${msg}`);
    return { success: false, errors: [msg] };
  }

  if (!order) {
    const msg = `Order #${orderId} not found`;
    console.error(`[email] ❌ ${msg}`);
    return { success: false, errors: [msg] };
  }

  // Send both emails in parallel
  const [customerResult, adminResult] = await Promise.all([
    sendOrderConfirmationEmail(order),
    sendAdminNewOrderEmail(order),
  ]);

  // Collect errors
  errors.push(...customerResult.errors);
  errors.push(...adminResult.errors);

  const success = customerResult.success && adminResult.success;

  if (success) {
    console.log(`[email] ✅ All emails sent for order #${orderId}`);
  } else {
    console.error(`[email] ⚠️ Some emails failed for order #${orderId}:`, errors);
  }

  return { success, errors };
}

// ============================================================================
// Export Config for Testing
// ============================================================================

export const emailConfig = {
  isConfigured: isMailerConfigured(),
  from: getMailFrom(),
  adminEmail: ADMIN_EMAIL,
  flags: {
    sendOrderEmail: SEND_ORDER_EMAIL,
    sendAdminOrderEmail: SEND_ADMIN_ORDER_EMAIL,
    sendLoginEmail: SEND_LOGIN_EMAIL,
  },
};
