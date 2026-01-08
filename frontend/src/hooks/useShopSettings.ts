/**
 * useShopSettings Hook
 *
 * Fetches and caches shop settings (free shipping threshold, default shipping fee)
 * using React Query for efficient caching and automatic refetching.
 */
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// Types
export interface ShopSettings {
    freeShippingThresholdDt: number;
    defaultShippingFeeDt: number;
    updatedAt?: string;
}

export interface ShippingResult {
    shippingFeeDt: number;
    isFreeShipping: boolean;
    freeShippingThresholdDt: number;
    amountUntilFreeShipping: number;
}

// Default fallback values (used when API fails)
const DEFAULT_SETTINGS: ShopSettings = {
    freeShippingThresholdDt: 200,
    defaultShippingFeeDt: 8,
};

/**
 * Compute shipping based on subtotal and settings
 */
export function computeShipping(
    subtotalDt: number,
    settings: ShopSettings
): ShippingResult {
    const { freeShippingThresholdDt, defaultShippingFeeDt } = settings;

    // If threshold is 0, shipping is always free
    if (freeShippingThresholdDt === 0) {
        return {
            shippingFeeDt: 0,
            isFreeShipping: true,
            freeShippingThresholdDt: 0,
            amountUntilFreeShipping: 0,
        };
    }

    const isFreeShipping = subtotalDt >= freeShippingThresholdDt;
    const amountUntilFreeShipping = isFreeShipping
        ? 0
        : Math.max(0, freeShippingThresholdDt - subtotalDt);

    return {
        shippingFeeDt: isFreeShipping ? 0 : defaultShippingFeeDt,
        isFreeShipping,
        freeShippingThresholdDt,
        amountUntilFreeShipping,
    };
}

/**
 * Format currency value for display
 * Shows DT with no trailing zeros if integer, otherwise 2 decimals
 */
export function formatDT(value: number): string {
    // Check if it's a whole number
    if (Number.isInteger(value)) {
        return `${value} DT`;
    }
    // Otherwise show 2 decimals
    return `${value.toFixed(2)} DT`;
}

/**
 * Hook to fetch shop settings
 */
export function useShopSettings() {
    return useQuery<ShopSettings>({
        queryKey: ["shopSettings"],
        queryFn: async () => {
            const res = await api.get("/api/settings");
            return res.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
        retry: 2,
        // Return default settings on error (fallback)
        placeholderData: DEFAULT_SETTINGS,
    });
}

/**
 * Get settings with fallback to defaults
 * Use this when you need guaranteed values (even if loading/error)
 */
export function useShopSettingsWithFallback(): ShopSettings {
    const { data } = useShopSettings();
    return data ?? DEFAULT_SETTINGS;
}

export default useShopSettings;
