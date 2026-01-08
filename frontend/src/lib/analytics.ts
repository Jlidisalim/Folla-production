/**
 * GA4 E-commerce Analytics Utility
 * src/lib/analytics.ts
 *
 * Provides typed functions for all GA4 e-commerce events.
 * Currency is always TND. No PII is ever sent.
 */

// ============================================================================
// Types
// ============================================================================

/** GA4 Item structure for e-commerce events */
export type GA4Item = {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_category2?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  currency: "TND";
  index?: number;
};

/** Product shape (matches your frontend product types) */
export type ProductForGA4 = {
  id: number | string;
  title?: string;
  name?: string;
  category?: string;
  subCategory?: string;
  slug?: string;
  pricePiece?: number | null;
  priceQuantity?: number | null;
  displayPrice?: number | null;
  unitPrice?: number | null;
};

/** Cart item shape (from CartContext) */
export type CartItemForGA4 = {
  productId: number | string;
  title: string;
  category?: string;
  subCategory?: string;
  unitPrice: number;
  quantity: number;
  variantLabel?: string | null;
  pricingMode?: "piece" | "quantity";
};

/** Order item shape (from backend order) */
export type OrderItemForGA4 = {
  productId: number | string;
  title: string;
  category?: string;
  subCategory?: string;
  unitPrice: number;
  quantity: number;
  variantLabel?: string | null;
};

// ============================================================================
// gtag Declaration & Safe Wrapper
// ============================================================================

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/** Safe gtag wrapper - no-ops if gtag or measurement ID is missing */
function gtag(...args: unknown[]): void {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag(...args);
  }
}

// ============================================================================
// Initialization
// ============================================================================

let ga4Initialized = false;

/**
 * Initialize GA4 by loading gtag.js with the measurement ID from env.
 * Call this once on app startup (e.g., in main.tsx).
 */
export function initGA4(): void {
  if (ga4Initialized) return;
  if (typeof window === "undefined") return;

  const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;

  if (!measurementId) {
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  // Load gtag.js script
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Configure GA4
  gtag("js", new Date());
  gtag("config", measurementId, {
    debug_mode: import.meta.env.DEV,
  });

  ga4Initialized = true;
}

// ============================================================================
// Mapping Helpers
// ============================================================================

/**
 * Map a product to GA4Item format.
 * NEVER includes PII - only product identifiers, categories, prices.
 */
export function mapProductToGA4Item(
  product: ProductForGA4,
  quantity: number = 1,
  variantLabel?: string | null,
  index?: number
): GA4Item {
  const price =
    product.unitPrice ??
    product.displayPrice ??
    product.pricePiece ??
    product.priceQuantity ??
    0;

  return {
    item_id: `prod_${product.id}`,
    item_name: product.title || product.name || `Product ${product.id}`,
    item_category: product.category || undefined,
    item_category2: product.subCategory || undefined,
    item_variant: variantLabel || undefined,
    price: Number(price),
    quantity,
    currency: "TND",
    ...(typeof index === "number" ? { index } : {}),
  };
}

/**
 * Map a cart item to GA4Item format.
 * NEVER includes PII.
 */
export function mapCartItemToGA4Item(
  cartItem: CartItemForGA4,
  index?: number
): GA4Item {
  return {
    item_id: `prod_${cartItem.productId}`,
    item_name: cartItem.title,
    item_category: cartItem.category || undefined,
    item_category2: cartItem.subCategory || undefined,
    item_variant: cartItem.variantLabel || undefined,
    price: Number(cartItem.unitPrice),
    quantity: cartItem.quantity,
    currency: "TND",
    ...(typeof index === "number" ? { index } : {}),
  };
}

/**
 * Map an order item to GA4Item format.
 * NEVER includes PII.
 */
export function mapOrderItemToGA4Item(
  orderItem: OrderItemForGA4,
  index?: number
): GA4Item {
  return {
    item_id: `prod_${orderItem.productId}`,
    item_name: orderItem.title,
    item_category: orderItem.category || undefined,
    item_category2: orderItem.subCategory || undefined,
    item_variant: orderItem.variantLabel || undefined,
    price: Number(orderItem.unitPrice),
    quantity: orderItem.quantity,
    currency: "TND",
    ...(typeof index === "number" ? { index } : {}),
  };
}

// ============================================================================
// E-commerce Event Functions
// ============================================================================

/**
 * Track view_item_list event - when a list of products is displayed.
 * Use for homepage, category pages, search results, etc.
 */
export function trackViewItemList(
  items: GA4Item[],
  itemListId: string,
  itemListName: string
): void {
  gtag("event", "view_item_list", {
    item_list_id: itemListId,
    item_list_name: itemListName,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}

/**
 * Track select_item event - when a user clicks on a product in a list.
 */
export function trackSelectItem(
  item: GA4Item,
  itemListId?: string,
  itemListName?: string,
  index?: number
): void {
  gtag("event", "select_item", {
    item_list_id: itemListId,
    item_list_name: itemListName,
    items: [{ ...item, index: index ?? item.index ?? 0 }],
  });
}

/**
 * Track view_item event - when a product detail page is viewed.
 */
export function trackViewItem(item: GA4Item, value?: number): void {
  gtag("event", "view_item", {
    currency: "TND",
    value: value ?? item.price * item.quantity,
    items: [item],
  });
}

/**
 * Track add_to_cart event.
 */
export function trackAddToCart(item: GA4Item, value?: number): void {
  gtag("event", "add_to_cart", {
    currency: "TND",
    value: value ?? item.price * item.quantity,
    items: [item],
  });
}

/**
 * Track remove_from_cart event.
 */
export function trackRemoveFromCart(item: GA4Item, value?: number): void {
  gtag("event", "remove_from_cart", {
    currency: "TND",
    value: value ?? item.price * item.quantity,
    items: [item],
  });
}

/**
 * Track view_cart event - when user views their cart.
 */
export function trackViewCart(items: GA4Item[], value: number): void {
  gtag("event", "view_cart", {
    currency: "TND",
    value,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}

/**
 * Track begin_checkout event - when user starts checkout.
 */
export function trackBeginCheckout(items: GA4Item[], value: number): void {
  gtag("event", "begin_checkout", {
    currency: "TND",
    value,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}

/**
 * Track add_shipping_info event - when user selects shipping option.
 * shipping_tier can be the region name or shipping method.
 */
export function trackAddShippingInfo(
  items: GA4Item[],
  value: number,
  shippingTier: string
): void {
  gtag("event", "add_shipping_info", {
    currency: "TND",
    value,
    shipping_tier: shippingTier,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}

/**
 * Track add_payment_info event - when user selects payment method.
 * payment_type: "cod", "paymee_card", "konnect_card", etc.
 */
export function trackAddPaymentInfo(
  items: GA4Item[],
  value: number,
  paymentType: string
): void {
  gtag("event", "add_payment_info", {
    currency: "TND",
    value,
    payment_type: paymentType,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}

/**
 * Track purchase event - when an order is completed.
 * This should only be called ONCE per transaction.
 *
 * @param transactionId - Unique order ID (e.g., "order_123")
 * @param value - Total order value including shipping
 * @param items - Order items mapped to GA4Item format
 * @param shipping - Shipping cost
 * @param tax - Tax amount (optional, default 0)
 */
export function trackPurchase(
  transactionId: string,
  value: number,
  items: GA4Item[],
  shipping: number = 0,
  tax: number = 0
): void {
  gtag("event", "purchase", {
    transaction_id: transactionId,
    currency: "TND",
    value,
    shipping,
    tax,
    items: items.map((item, i) => ({ ...item, index: item.index ?? i })),
  });
}
