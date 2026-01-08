/* src/components/WishlistContext.tsx */
/* Context for managing wishlist items with API persistence for logged-in users */
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

export interface WishlistItem {
    id?: number; // Database ID (only for logged-in users)
    productId: string;
    title: string;
    price: number;
    image: string;
    addedAt: Date;
}

interface WishlistContextType {
    wishlist: WishlistItem[];
    addToWishlist: (item: Omit<WishlistItem, "addedAt" | "id">) => Promise<void>;
    removeFromWishlist: (productId: string) => Promise<void>;
    isInWishlist: (productId: string) => boolean;
    toggleWishlist: (item: Omit<WishlistItem, "addedAt" | "id">) => Promise<void>;
    clearWishlist: () => Promise<void>;
    totalItems: number;
    loading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const WISHLIST_KEY = "guest_wishlist";

// Transform database wishlist item to WishlistItem
function transformWishlistItem(dbItem: any): WishlistItem {
    return {
        id: dbItem.id,
        productId: String(dbItem.productId),
        title: dbItem.titleAtAdd,
        price: dbItem.priceAtAdd,
        image: dbItem.imageAtAdd || "",
        addedAt: new Date(dbItem.createdAt),
    };
}

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
    const { userId, isSignedIn, getToken } = useAuth();
    const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(false);

    // Helper function to get authenticated API instance
    const getAuthApi = useCallback(async () => {
        if (!isSignedIn) return null;
        const token = await getToken();
        if (!token) return null;
        return createAuthenticatedApi(token);
    }, [isSignedIn, getToken]);

    // Load wishlist based on auth state
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (isSignedIn && userId) {
                // Logged-in: Load from database with JWT token
                try {
                    setLoading(true);

                    const token = await getToken();
                    if (!token) {
                        setWishlist([]);
                        return;
                    }

                    const authApi = createAuthenticatedApi(token);
                    const res = await authApi.get("/api/wishlist");

                    if (cancelled) return;

                    const items = res.data?.wishlist?.items || [];
                    const transformedItems = items.map(transformWishlistItem);
                    setWishlist(transformedItems);
                } catch (err) {
                    console.error("[Wishlist] Failed to load from database:", err);
                    setWishlist([]);
                } finally {
                    if (!cancelled) setLoading(false);
                }
            } else {
                // Guest: Load from localStorage
                try {
                    const stored = localStorage.getItem(WISHLIST_KEY);
                    if (stored) {
                        const guestWishlist = JSON.parse(stored);
                        setWishlist(guestWishlist.map((item: WishlistItem) => ({
                            ...item,
                            addedAt: new Date(item.addedAt),
                        })));
                    } else {
                        setWishlist([]);
                    }
                } catch {
                    setWishlist([]);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [isSignedIn, userId, getToken]);

    useEffect(() => {
        if (!isSignedIn && wishlist.length >= 0) {
            try {
                localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
            } catch {
                // Silent fail for localStorage
            }
        }
    }, [wishlist, isSignedIn]);

    const addToWishlist = useCallback(
        async (item: Omit<WishlistItem, "addedAt" | "id">) => {
            // Check if already exists
            if (wishlist.some((w) => w.productId === item.productId)) {
                return;
            }

            const newItem: WishlistItem = { ...item, addedAt: new Date() };

            if (isSignedIn && userId) {
                // Logged-in: API call with JWT token
                try {
                    // Optimistic update
                    setWishlist((prev) => [...prev, newItem]);

                    const authApi = await getAuthApi();
                    if (!authApi) {
                        setWishlist((prev) => prev.filter((i) => i.productId !== item.productId));
                        return;
                    }

                    const res = await authApi.post("/api/wishlist/items", {
                        productId: Number(item.productId),
                        price: item.price,
                        title: item.title,
                        image: item.image,
                    });

                    // Replace with server response
                    const items = res.data?.wishlist?.items || [];
                    setWishlist(items.map(transformWishlistItem));
                } catch (err) {
                    console.error("[Wishlist] Failed to add item:", err);
                    // Revert optimistic update
                    setWishlist((prev) => prev.filter((i) => i.productId !== item.productId));
                }
            } else {
                // Guest: localStorage only
                setWishlist((prev) => [...prev, newItem]);
            }
        },
        [isSignedIn, userId, wishlist, getAuthApi]
    );

    const removeFromWishlist = useCallback(
        async (productId: string) => {
            const item = wishlist.find((i) => i.productId === productId);
            if (!item) return;

            if (isSignedIn && userId) {
                // Logged-in: API call with JWT token
                try {
                    // Optimistic update
                    setWishlist((prev) => prev.filter((i) => i.productId !== productId));

                    const authApi = await getAuthApi();
                    if (authApi) {
                        await authApi.delete(`/api/wishlist/product/${productId}`);
                    }
                } catch (err) {
                    console.error("[Wishlist] Failed to remove item:", err);
                    // Re-add on error
                    setWishlist((prev) => [...prev, item]);
                }
            } else {
                // Guest: localStorage only
                setWishlist((prev) => prev.filter((i) => i.productId !== productId));
            }
        },
        [isSignedIn, userId, wishlist, getAuthApi]
    );

    const isInWishlist = useCallback(
        (productId: string) => wishlist.some((item) => item.productId === productId),
        [wishlist]
    );

    const toggleWishlist = useCallback(
        async (item: Omit<WishlistItem, "addedAt" | "id">) => {
            if (isInWishlist(item.productId)) {
                await removeFromWishlist(item.productId);
            } else {
                await addToWishlist(item);
            }
        },
        [isInWishlist, removeFromWishlist, addToWishlist]
    );

    const clearWishlist = useCallback(async () => {
        if (isSignedIn && userId) {
            // Logged-in: API call with JWT token
            try {
                setWishlist([]);
                const authApi = await getAuthApi();
                if (authApi) {
                    await authApi.delete("/api/wishlist/clear");
                }
            } catch (err) {
                console.error("[Wishlist] Failed to clear:", err);
            }
        } else {
            // Guest: localStorage only
            setWishlist([]);
            localStorage.removeItem(WISHLIST_KEY);
        }
    }, [isSignedIn, userId, getAuthApi]);

    const totalItems = wishlist.length;

    return (
        <WishlistContext.Provider
            value={{
                wishlist,
                addToWishlist,
                removeFromWishlist,
                isInWishlist,
                toggleWishlist,
                clearWishlist,
                totalItems,
                loading,
            }}
        >
            {children}
        </WishlistContext.Provider>
    );
};

export const useWishlist = () => {
    const ctx = useContext(WishlistContext);
    if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
    return ctx;
};
