/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useAuth } from "@clerk/clerk-react";
import api, { createAuthenticatedApi } from "@/lib/api";
import {
  trackAddToCart,
  trackRemoveFromCart,
  mapCartItemToGA4Item,
} from "@/lib/analytics";

export type PricingMode = "piece" | "quantity";

export interface CartItem {
  id?: number; // Database ID (only for logged-in users)
  lineId: string;
  productId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  image: string;
  pricingMode: PricingMode;
  combinationId?: string | null;
  selectedOptions: Record<string, string>;
  variantLabel?: string | null;  // Human-readable variant (e.g. "Size: M, Color: Blue")
  shippingPrice?: number;
  minQty?: number;
  maxQty?: number;
  rating?: number;
  ratingCount?: number;
}

type IncomingItem = Partial<CartItem> & {
  productId: string | number;
  title: string;
  unitPrice: number;
  pricingMode: PricingMode;
  selectedOptions?: Record<string, string>;
  combinationId?: string | null;
  quantity?: number;
  image?: string | null;
  imageUrl?: string | null;
  variantLabel?: string | null;
  shippingPrice?: number;
  minQty?: number;
  maxQty?: number;
};

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: IncomingItem) => Promise<void>;
  removeFromCart: (lineId: string) => Promise<void>;
  updateQuantity: (lineId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalQuantity: number;
  totalPrice: number;
  shippingTotal: number;
  isFreeShipping: boolean;
  freeShippingThresholdDt: number;
  amountUntilFreeShipping: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";
const DEFAULT_SHIPPING_FEE = 8;
const DEFAULT_FREE_SHIPPING_THRESHOLD = 200;
const GUEST_CART_KEY = "guest_cart";  // sessionStorage key

function normalizeImage(src?: string | null): string {
  if (!src)
    return `${window.location.protocol}//${window.location.host}/placeholder.png`;
  const s = String(src).trim();
  if (!s)
    return `${window.location.protocol}//${window.location.host}/placeholder.png`;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/uploads/"))
    return `${baseURL.replace(/\/$/, "")}/products${s}`;
  if (s.startsWith("/products/uploads/"))
    return `${baseURL.replace(/\/$/, "")}${s}`;
  if (s.startsWith("uploads/"))
    return `${baseURL.replace(/\/$/, "")}/products/${s}`;
  return `${baseURL.replace(/\/$/, "")}/products/uploads/${s.replace(
    /^\/+/,
    ""
  )}`;
}

function buildLineId(
  productId: string | number,
  combinationId: string | null | undefined,
  pricingMode: PricingMode,
  selectedOptions: Record<string, string>
) {
  const stableOptionsKey = Object.entries(selectedOptions || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
  return `${productId}::${combinationId ?? "base"}::${pricingMode}::${stableOptionsKey || "none"
    }`;
}

// Transform database cart item to CartItem
function transformCartItem(dbItem: any): CartItem {
  const lineId = buildLineId(
    dbItem.productId,
    dbItem.combinationId,
    dbItem.unitType,
    dbItem.optionsAtAdd || {}
  );

  return {
    id: dbItem.id,
    lineId,
    productId: String(dbItem.productId),
    title: dbItem.titleAtAdd,
    unitPrice: dbItem.priceAtAdd,
    quantity: dbItem.quantity,
    image: normalizeImage(dbItem.imageAtAdd),
    pricingMode: dbItem.unitType as PricingMode,
    combinationId: dbItem.combinationId || null,
    selectedOptions: dbItem.optionsAtAdd || {},
    variantLabel: dbItem.variantLabel || null,  // From database
    minQty: dbItem.minQty || 1,
    maxQty: dbItem.maxQty || undefined,
  };
}

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { userId, isSignedIn, getToken } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [shopSettings, setShopSettings] = useState({
    defaultShippingFeeDt: DEFAULT_SHIPPING_FEE,
    freeShippingThresholdDt: DEFAULT_FREE_SHIPPING_THRESHOLD,
  });

  // Helper function to get authenticated API instance
  const getAuthApi = useCallback(async () => {
    if (!isSignedIn) return null;
    const token = await getToken();
    if (!token) return null;
    return createAuthenticatedApi(token);
  }, [isSignedIn, getToken]);

  // Cleanup old localStorage cart on first load
  useEffect(() => {
    const migrated = localStorage.getItem("cart_db_migrated");
    if (!migrated) {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("cart_")) {
          localStorage.removeItem(key);
        }
      });
      localStorage.setItem("cart_db_migrated", "true");
    }
  }, []);

  // Fetch shop settings (free shipping threshold and default fee)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/settings");
        const data = res.data;
        if (!cancelled && data) {
          setShopSettings({
            defaultShippingFeeDt: Number(data.defaultShippingFeeDt) || DEFAULT_SHIPPING_FEE,
            freeShippingThresholdDt: Number(data.freeShippingThresholdDt) ?? DEFAULT_FREE_SHIPPING_THRESHOLD,
          });
        }
      } catch (err) {
        console.warn("[Cart] Failed to load shop settings, using defaults", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load cart based on auth state
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (isSignedIn && userId) {
        // Logged-in: Load from database with JWT token
        try {
          setLoading(true);

          // Get JWT token from Clerk
          const token = await getToken();
          if (!token) {
            setCart([]);
            return;
          }

          // Create authenticated API instance
          const authApi = createAuthenticatedApi(token);
          const res = await authApi.get("/api/cart");

          if (cancelled) return;

          const items = res.data?.cart?.items || [];
          const transformedItems = items.map(transformCartItem);
          setCart(transformedItems);
        } catch (err) {
          console.error("[Cart] Failed to load cart from database:", err);
          setCart([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        // Guest: Load from sessionStorage
        try {
          const stored = sessionStorage.getItem(GUEST_CART_KEY);
          if (stored) {
            const guestCart = JSON.parse(stored);
            setCart(guestCart);
          } else {
            setCart([]);
          }
        } catch {
          setCart([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSignedIn, userId, getToken]);

  // Save guest cart to sessionStorage whenever cart changes
  useEffect(() => {
    if (!isSignedIn && cart.length >= 0) {
      try {
        sessionStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart));
      } catch {
        // Silent fail for sessionStorage
      }
    }
  }, [cart, isSignedIn]);

  // Add to cart - dual mode
  const addToCart = async (incoming: IncomingItem) => {
    // Validate
    if (
      !incoming.productId ||
      incoming.productId === "undefined" ||
      !incoming.title ||
      !incoming.unitPrice
    ) {
      console.error("[Cart] Invalid item data:", incoming);
      return;
    }

    const tempLineId = buildLineId(
      incoming.productId,
      incoming.combinationId,
      incoming.pricingMode,
      incoming.selectedOptions || {}
    );

    const cartItem: CartItem = {
      lineId: tempLineId,
      productId: String(incoming.productId),
      title: incoming.title,
      unitPrice: incoming.unitPrice,
      quantity: incoming.quantity || 1,
      image: normalizeImage(incoming.image || incoming.imageUrl),
      pricingMode: incoming.pricingMode,
      combinationId: incoming.combinationId || null,
      selectedOptions: incoming.selectedOptions || {},
      variantLabel: incoming.variantLabel || null,  // Accept variant label
      minQty: incoming.minQty || 1,
      maxQty: incoming.maxQty,
    };

    if (isSignedIn && userId) {
      // Logged-in: API call
      try {
        // Optimistic update
        setCart((prev) => [...prev, cartItem]);

        // Get authenticated API
        const authApi = await getAuthApi();
        if (!authApi) {
          console.error("[Cart] Failed to get auth API");
          setCart((prev) => prev.filter((i) => i.lineId !== tempLineId));
          return;
        }

        const res = await authApi.post("/api/cart/items", {
          productId: Number(incoming.productId),
          combinationId: incoming.combinationId || null,
          quantity: incoming.quantity || 1,
          unitType: incoming.pricingMode,
          variantLabel: incoming.variantLabel || null,
          priceFromClient: incoming.unitPrice,
        });

        // Replace with server response
        const items = res.data?.cart?.items || [];
        setCart(items.map(transformCartItem));
      } catch (err: any) {
        console.error("[Cart] Failed to add item to database:", err);
        // Revert optimistic update
        setCart((prev) => prev.filter((i) => i.lineId !== tempLineId));
      }
    } else {
      // Guest: sessionStorage only
      setCart((prev) => {
        // Check if item exists
        const existing = prev.find((i) => i.lineId === tempLineId);
        if (existing) {
          // Update quantity
          return prev.map((i) =>
            i.lineId === tempLineId
              ? { ...i, quantity: i.quantity + cartItem.quantity }
              : i
          );
        }
        // Add new item
        return [...prev, cartItem];
      });
    }

    // GA4: Track add_to_cart event (no PII - only product identifiers)
    trackAddToCart(
      mapCartItemToGA4Item(cartItem),
      cartItem.unitPrice * cartItem.quantity
    );
  };

  // Remove from cart - dual mode
  const removeFromCart = async (lineId: string) => {
    const item = cart.find((i) => i.lineId === lineId);
    if (!item) return;

    // GA4: Track remove_from_cart event (no PII - only product identifiers)
    trackRemoveFromCart(
      mapCartItemToGA4Item(item),
      item.unitPrice * item.quantity
    );

    if (isSignedIn && userId) {
      // Logged-in: API call
      try {
        // Optimistic update
        setCart((prev) => prev.filter((i) => i.lineId !== lineId));

        if (item.id) {
          const authApi = await getAuthApi();
          if (authApi) {
            await authApi.delete(`/api/cart/items/${item.id}`);
          }
        }
      } catch (err) {
        console.error("[Cart] Failed to remove item from database:", err);
        // Re-fetch cart
        const authApi = await getAuthApi();
        if (authApi) {
          const res = await authApi.get("/api/cart");
          const items = res.data?.cart?.items || [];
          setCart(items.map(transformCartItem));
        }
      }
    } else {
      // Guest: sessionStorage only
      setCart((prev) => prev.filter((i) => i.lineId !== lineId));
    }
  };

  // Update quantity - dual mode
  const updateQuantity = async (lineId: string, quantity: number) => {
    if (quantity < 1) return;

    const item = cart.find((i) => i.lineId === lineId);
    if (!item) return;

    if (isSignedIn && userId) {
      // Logged-in: API call
      try {
        // Optimistic update
        setCart((prev) =>
          prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
        );

        if (item.id) {
          const authApi = await getAuthApi();
          if (authApi) {
            await authApi.patch(`/api/cart/items/${item.id}`, { quantity });
          }
        }
      } catch (err) {
        console.error("[Cart] Failed to update quantity in database:", err);
        // Re-fetch cart
        const authApi = await getAuthApi();
        if (authApi) {
          const res = await authApi.get("/api/cart");
          const items = res.data?.cart?.items || [];
          setCart(items.map(transformCartItem));
        }
      }
    } else {
      // Guest: sessionStorage only
      setCart((prev) =>
        prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
      );
    }
  };

  // Clear cart - dual mode
  const clearCart = async () => {
    if (isSignedIn && userId) {
      // Logged-in: API call
      try {
        setCart([]);
        const authApi = await getAuthApi();
        if (authApi) {
          await authApi.delete("/api/cart/clear");
        }
      } catch (err) {
        console.error("[Cart] Failed to clear cart in database:", err);
      }
    } else {
      // Guest: sessionStorage only
      setCart([]);
      sessionStorage.removeItem(GUEST_CART_KEY);
    }
  };

  const totalItems = cart.length;
  const totalQuantity = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = cart.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);

  // Free shipping calculation
  const { freeShippingThresholdDt, defaultShippingFeeDt } = shopSettings;
  const isFreeShipping = freeShippingThresholdDt === 0 || totalPrice >= freeShippingThresholdDt;
  const amountUntilFreeShipping = isFreeShipping ? 0 : Math.max(0, freeShippingThresholdDt - totalPrice);
  const shippingTotal = cart.length === 0 ? 0 : (isFreeShipping ? 0 : defaultShippingFeeDt);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalQuantity,
        totalPrice,
        shippingTotal,
        isFreeShipping,
        freeShippingThresholdDt,
        amountUntilFreeShipping,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
};
