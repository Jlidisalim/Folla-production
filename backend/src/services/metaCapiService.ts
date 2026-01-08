/**
 * Meta Conversions API (CAPI) Service
 * src/services/metaCapiService.ts
 *
 * Server-side event tracking for Meta/Facebook.
 * All PII (email, phone, external_id) is hashed with SHA-256 before sending.
 *
 * Events supported:
 * - ViewContent (product page view)
 * - AddToCart
 * - InitiateCheckout (order creation)
 * - Purchase (payment confirmed)
 */

import crypto from "crypto";
import { metaCapiConfig } from "../config/marketing";

// ============================================================================
// Types
// ============================================================================

export type MetaEventName =
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase";

export interface MetaUserData {
  email?: string;
  phone?: string;
  city?: string;
  country?: string; // ISO code, e.g., "TN"
  clientIp?: string;
  clientUserAgent?: string;
  externalId?: string; // e.g., Clerk user ID
}

export interface MetaContentItem {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface MetaCustomData {
  value?: number;
  currency?: string; // Always "TND"
  contents?: MetaContentItem[];
  content_type?: string; // "product" or "product_group"
  num_items?: number;
}

export interface SendCapiEventParams {
  eventName: MetaEventName;
  eventId: string;
  eventTime?: number; // Unix timestamp in seconds
  eventSourceUrl?: string;
  userData: MetaUserData;
  customData: MetaCustomData;
}

// ============================================================================
// PII Hashing Utilities
// ============================================================================

/**
 * Normalize email for hashing: lowercase, trim, empty if falsy.
 */
export function normalizeEmail(email: string | undefined | null): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Normalize phone for hashing: trim, remove spaces/non-digits except leading +.
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return "";
  const trimmed = phone.trim();
  // Keep leading + for international, remove all other non-digits
  if (trimmed.startsWith("+")) {
    return "+" + trimmed.slice(1).replace(/[^0-9]/g, "");
  }
  return trimmed.replace(/[^0-9]/g, "");
}

/**
 * Hash a value with SHA-256 and return hex string.
 * Returns empty string if input is empty.
 */
export function hashSha256(value: string): string {
  if (!value) return "";
  return crypto.createHash("sha256").update(value).digest("hex");
}

// ============================================================================
// Core Event Sender
// ============================================================================

/**
 * Send an event to Meta Conversions API.
 *
 * This function:
 * - Returns immediately if CAPI is disabled
 * - Hashes all PII (email, phone, external_id)
 * - Adds test_event_code if in test mode
 * - Never throws - catches and logs errors
 *
 * @param params Event parameters
 */
export async function sendCapiEvent(params: SendCapiEventParams): Promise<void> {
  // Exit early if disabled
  if (!metaCapiConfig.enabled) {
    return;
  }

  const {
    eventName,
    eventId,
    eventTime = Math.floor(Date.now() / 1000),
    eventSourceUrl,
    userData,
    customData,
  } = params;

  try {
    // Build user_data with hashed PII
    const hashedUserData: Record<string, string | undefined> = {};

    // Hash email
    const normalizedEmail = normalizeEmail(userData.email);
    if (normalizedEmail) {
      hashedUserData.em = hashSha256(normalizedEmail);
    }

    // Hash phone
    const normalizedPhone = normalizePhone(userData.phone);
    if (normalizedPhone) {
      hashedUserData.ph = hashSha256(normalizedPhone);
    }

    // Hash external ID (Clerk user ID)
    if (userData.externalId) {
      hashedUserData.external_id = hashSha256(userData.externalId);
    }

    // Non-hashed fields (Meta expects these as-is)
    if (userData.city) {
      hashedUserData.ct = userData.city.toLowerCase().trim();
    }
    if (userData.country) {
      hashedUserData.country = userData.country.toLowerCase().trim();
    }
    if (userData.clientIp) {
      hashedUserData.client_ip_address = userData.clientIp;
    }
    if (userData.clientUserAgent) {
      hashedUserData.client_user_agent = userData.clientUserAgent;
    }

    // Build event data
    const eventData: Record<string, unknown> = {
      event_name: eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: "website",
      user_data: hashedUserData,
    };

    // Add event source URL if provided
    if (eventSourceUrl) {
      eventData.event_source_url = eventSourceUrl;
    }

    // Build custom_data
    const customDataPayload: Record<string, unknown> = {};
    if (customData.value !== undefined) {
      customDataPayload.value = customData.value;
    }
    if (customData.currency) {
      customDataPayload.currency = customData.currency;
    }
    if (customData.contents && customData.contents.length > 0) {
      customDataPayload.contents = customData.contents;
    }
    if (customData.content_type) {
      customDataPayload.content_type = customData.content_type;
    }
    if (customData.num_items !== undefined) {
      customDataPayload.num_items = customData.num_items;
    }

    if (Object.keys(customDataPayload).length > 0) {
      eventData.custom_data = customDataPayload;
    }

    // Build request payload
    const payload: Record<string, unknown> = {
      data: [eventData],
    };

    // Add test_event_code if in test mode
    if (metaCapiConfig.useTestMode && metaCapiConfig.testEventCode) {
      payload.test_event_code = metaCapiConfig.testEventCode;
    }

    // Build API URL
    const apiUrl = `https://graph.facebook.com/v18.0/${metaCapiConfig.pixelId}/events?access_token=${metaCapiConfig.accessToken}`;

    // Send request
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseData = (await response.json()) as { events_received?: number; error?: unknown };

    if (!response.ok) {
      console.error(
        `[MetaCAPI] Error sending ${eventName} event (${eventId}):`,
        responseData
      );
      return;
    }

    console.log(
      `[MetaCAPI] ${eventName} event sent successfully (${eventId})`,
      metaCapiConfig.useTestMode ? "[TEST MODE]" : "",
      `events_received: ${responseData.events_received ?? 0}`
    );
  } catch (error) {
    console.error(
      `[MetaCAPI] Exception sending ${eventName} event (${eventId}):`,
      error instanceof Error ? error.message : error
    );
  }
}

// ============================================================================
// Convenience Wrappers
// ============================================================================

/**
 * Product shape for ViewContent tracking
 */
export interface ProductForCapi {
  id: number | string;
  title?: string;
  name?: string;
  category?: string;
  pricePiece?: number | null;
  priceQuantity?: number | null;
  displayPrice?: number | null;
}

/**
 * Track ViewContent event - when a product detail page is viewed.
 */
export function trackViewContent(
  product: ProductForCapi,
  userData: MetaUserData,
  eventId: string,
  eventSourceUrl?: string
): void {
  const price =
    product.displayPrice ?? product.pricePiece ?? product.priceQuantity ?? 0;
  const productId = String(product.id);
  const productName = product.title || product.name || `Product ${product.id}`;

  void sendCapiEvent({
    eventName: "ViewContent",
    eventId,
    eventSourceUrl,
    userData,
    customData: {
      value: Number(price),
      currency: "TND",
      contents: [
        {
          id: productId,
          quantity: 1,
          item_price: Number(price),
        },
      ],
      content_type: "product",
    },
  });
}

/**
 * Cart item shape for AddToCart tracking
 */
export interface CartItemForCapi {
  productId: number | string;
  title: string;
  unitPrice: number;
  quantity: number;
}

/**
 * Track AddToCart event - when a product is added to cart.
 */
export function trackAddToCart(
  cartItem: CartItemForCapi,
  userData: MetaUserData,
  eventId: string,
  eventSourceUrl?: string
): void {
  const value = cartItem.unitPrice * cartItem.quantity;

  void sendCapiEvent({
    eventName: "AddToCart",
    eventId,
    eventSourceUrl,
    userData,
    customData: {
      value,
      currency: "TND",
      contents: [
        {
          id: String(cartItem.productId),
          quantity: cartItem.quantity,
          item_price: cartItem.unitPrice,
        },
      ],
      content_type: "product",
      num_items: cartItem.quantity,
    },
  });
}

/**
 * Order-like shape for InitiateCheckout tracking
 */
export interface OrderLikeForCapi {
  id: number | string;
  total: number;
  items: Array<{
    productId?: number | string;
    product?: { id: number | string };
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Track InitiateCheckout event - when checkout is started (order created).
 */
export function trackInitiateCheckout(
  order: OrderLikeForCapi,
  userData: MetaUserData,
  eventId: string,
  eventSourceUrl?: string
): void {
  const contents: MetaContentItem[] = order.items.map((item) => ({
    id: String(item.productId ?? item.product?.id ?? "unknown"),
    quantity: item.quantity,
    item_price: item.unitPrice,
  }));

  const numItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  void sendCapiEvent({
    eventName: "InitiateCheckout",
    eventId,
    eventSourceUrl,
    userData,
    customData: {
      value: order.total,
      currency: "TND",
      contents,
      content_type: "product",
      num_items: numItems,
    },
  });
}

/**
 * Order shape for Purchase tracking
 */
export interface OrderForCapi {
  id: number | string;
  total: number;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  items: Array<{
    productId?: number | string;
    product?: { id: number | string };
    quantity: number;
    unitPrice: number;
  }>;
}

/**
 * Track Purchase event - when payment is confirmed.
 */
export function trackPurchase(
  order: OrderForCapi,
  userData: MetaUserData,
  eventId: string,
  eventSourceUrl?: string
): void {
  const contents: MetaContentItem[] = order.items.map((item) => ({
    id: String(item.productId ?? item.product?.id ?? "unknown"),
    quantity: item.quantity,
    item_price: item.unitPrice,
  }));

  const numItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

  void sendCapiEvent({
    eventName: "Purchase",
    eventId,
    eventSourceUrl,
    userData,
    customData: {
      value: order.total,
      currency: "TND",
      contents,
      content_type: "product",
      num_items: numItems,
    },
  });
}
