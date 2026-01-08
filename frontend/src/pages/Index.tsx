// src/pages/Index.tsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import Header from "@/components/Header";
import HeroGrid from "@/components/HeroGrid";
import ProductSection from "@/components/ProductSection";
import Footer from "@/components/Footer";
import { useProducts } from "@/hooks/useProducts";
import { Product as LPProduct } from "@/lib/products";
import api from "@/lib/api";
import { trackViewItemList, mapProductToGA4Item } from "@/lib/analytics";
import { IndexPageSkeleton } from "@/components/skeletons";
// GEO + SEO imports
import SEOHead, { getOrganizationSchema } from "@/components/SEOHead";
import { PurchaseUnit } from "@/lib/price";


/**
 * Local Product shape (matches what backend returns, loosely)
 */
type Product = {
  id: number;
  title: string;
  description?: string;
  category?: string;
  subCategory?: string;
  images?: string[] | null;
  image?: string | null; // single image alias
  pricePiece?: number;
  priceQuantity?: number;
  saleType?: "piece" | "quantity" | "both";
  inStock?: boolean;
  displayPrice?: number;
  displayFlashPrice?: number;
  venteFlashActive?: boolean;
  venteFlashPercentage?: number;
  flashPrice?: number | null;
  availableQuantity?: number;
  // other fields allowed
};

type Client = {
  id: number;
  purchaseUnit?: PurchaseUnit;
  clerkId?: string;
  phone?: string;
};

const Index: React.FC = () => {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const hasTrackedViewItemList = useRef(false);

  // Reset clientLoaded when auth state changes
  useEffect(() => {
    if (authLoaded && !userId) {
      setClientLoaded(true);
    } else if (!authLoaded) {
      setClientLoaded(false);
    }
  }, [authLoaded, userId]);

  // Fetch client data for logged-in users
  useEffect(() => {
    if (!authLoaded || !userId) return;
    
    let mounted = true;
    const fetchClient = async () => {
      try {
        const res = await api.get("/clients/current", {
          params: { clerkId: userId },
        });
        if (mounted) {
          setClient(res.data as Client);
          setClientLoaded(true);
        }
      } catch (err: any) {
        // Try fallback endpoint
        try {
          const res = await api.get("/clients/me");
          if (mounted) {
            setClient(res.data as Client);
            setClientLoaded(true);
          }
        } catch {
          // No client found, but loading is done
          if (mounted) setClientLoaded(true);
        }
      }
    };
    
    fetchClient();
    return () => { mounted = false; };
  }, [authLoaded, userId]);

  useEffect(() => {
    const trackVisitor = async () => {
      if (sessionStorage.getItem("follaVisitorTracked") === "1") return;
      // flag immediately to avoid duplicate increments when React StrictMode re-runs effects
      sessionStorage.setItem("follaVisitorTracked", "1");
      try {
        await api.post("/api/visitors/increment");
      } catch (err) {
        console.warn("Visitor tracking failed:", err);
        sessionStorage.removeItem("follaVisitorTracked");
      }
    };
    trackVisitor();
  }, []);

  const {
    data: products = [],
    isLoading,
    error,
  } = useProducts() as {
    data: Product[];
    isLoading: boolean;
    error: Error | null;
  };

  // base url from axios instance or fallback
  const baseURL = (api.defaults?.baseURL as string) || "http://localhost:4000";

  // Normalize image path returned by backend into absolute URL (matches ProductListing logic)
  function normalizeImage(src?: string | null) {
    if (!src) {
      // prefer absolute placeholder served by frontend; adjust if your placeholder is elsewhere
      return `${window.location.protocol}//${window.location.host}/placeholder.png`;
    }
    const s = String(src).trim();
    if (!s) {
      return `${window.location.protocol}//${window.location.host}/placeholder.png`;
    }
    // already absolute
    if (/^https?:\/\//i.test(s)) return s;
    // backend sometimes returns "/uploads/..." but product router serves uploads under /products/uploads
    // replicate the logic you used in ProductListing
    if (s.startsWith("/uploads/")) {
      return `${baseURL.replace(/\/$/, "")}/products${s}`;
    }
    if (s.startsWith("/products/uploads/")) {
      return `${baseURL.replace(/\/$/, "")}${s}`;
    }
    if (s.startsWith("uploads/")) {
      return `${baseURL.replace(/\/$/, "")}/products/${s}`;
    }
    // fallback
    return `${baseURL.replace(/\/$/, "")}/products/uploads/${s.replace(
      /^\/+/,
      ""
    )}`;
  }

  // convert all product images to absolute URLs and ensure fields exist
  const deriveBasePrice = (p: Product) => {
    if (p.displayPrice !== undefined && p.displayPrice !== null)
      return Number(p.displayPrice);
    if (p.pricePiece !== undefined && p.pricePiece !== null)
      return Number(p.pricePiece);
    if (p.priceQuantity !== undefined && p.priceQuantity !== null)
      return Number(p.priceQuantity);
    return 0;
  };
  const deriveFlashPrice = (p: Product) => {
    if (p.displayFlashPrice !== undefined && p.displayFlashPrice !== null)
      return Number(p.displayFlashPrice);
    if (p.flashPrice !== undefined && p.flashPrice !== null)
      return Number(p.flashPrice);
    return null;
  };

  const normalizedProducts: Product[] = (products || []).map((p) => {
    const imgs =
      Array.isArray(p.images) && p.images.length
        ? p.images.map((img) => normalizeImage(img))
        : [];
    const firstImage =
      (p.image && normalizeImage(p.image)) ||
      (imgs.length ? imgs[0] : undefined);
    return {
      ...p,
      images: imgs,
      image:
        firstImage ??
        `${window.location.protocol}//${window.location.host}/placeholder.png`,
      displayPrice: deriveBasePrice(p),
      displayFlashPrice: deriveFlashPrice(p),
    };
  });

  // GA4: Track view_item_list when products load (no PII - only product identifiers)
  useEffect(() => {
    if (normalizedProducts.length > 0 && !isLoading && !hasTrackedViewItemList.current) {
      hasTrackedViewItemList.current = true;
      trackViewItemList(
        normalizedProducts.slice(0, 50).map((p, i) =>
          mapProductToGA4Item(
            {
              id: p.id,
              title: p.title,
              category: p.category,
              subCategory: p.subCategory,
              displayPrice: p.displayPrice,
            },
            1,
            undefined,
            i
          )
        ),
        "home",
        "Homepage"
      );
    }
  }, [normalizedProducts, isLoading]);

  // Format category name nicely
  const formatCategoryTitle = (slug?: string): string => {
    if (!slug) return "Uncategorized";
    const titleMap: Record<string, string> = {
      "art-de-la-table": "Art de la table",
      nouveautes: "Nouveautés Exquises",
      decoration: "Décoration",
      cuisine: "Cuisine",
      sacs: "Sacs et accessoires",
    };
    const key = slug.toString();
    return (
      titleMap[key] ||
      key.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    );
  };

  // 🔹 Group products by category
  const categoryGroups = normalizedProducts.reduce((acc, product) => {
    const cat = product.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const sortedCategoryEntries: [string, Product[]][] = Object.entries(
    categoryGroups
  )
    // ❌ remove categories that have only 1 product
    .filter(([, prods]) => prods.length >= 2)
    // 🔽 sort by number of products (desc): 4+, then 3, then 2
    .sort((a, b) => b[1].length - a[1].length);

  if (!authLoaded || isLoading || !clientLoaded) {
    return (
      <div className="min-h-screen flex flex-col" role="status" aria-busy="true">
        <Header products={[]} />
        <IndexPageSkeleton />
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header products={[]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-red-500">
              Erreur lors du chargement des produits
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* SEO Head avec JSON-LD Organization */}
      <SEOHead
        title="FollaCouffin – Artisanat tunisien fait main | Déco, paniers & sacs"
        description="Boutique en ligne d'artisanat tunisien : décoration, paniers, sacs faits main. Livraison partout en Tunisie. Paiement à la livraison."
        canonicalUrl="https://follacouffin.tn/"
        jsonLd={getOrganizationSchema()}
      />

      {/* pass normalizedProducts to Header so search / suggestions have correct image urls */}
      <Header
        products={
          normalizedProducts.map((p) => ({
            id: String(p.id),
            title: p.title,
            image: p.image || "/placeholder.png",
            images: p.images ?? [],
            currentPrice: String(
              p.displayPrice ??
                p.pricePiece ??
                p.priceQuantity ??
                p.flashPrice ??
                0
            ),
            venteFlashActive: p.venteFlashActive,
            venteFlashPercentage: p.venteFlashPercentage
              ? String(p.venteFlashPercentage)
              : undefined,
            venteFlashPrice: p.displayFlashPrice
              ? String(p.displayFlashPrice)
              : undefined,
            category: p.category ?? "uncategorized",
          })) as unknown as LPProduct[]
        }
      />
      <HeroGrid />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4">
          {sortedCategoryEntries.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              Aucun produit trouvé.
            </div>
          ) : (
            sortedCategoryEntries.map(([category, prods]) => {
              // 👉 show at most 4 products per category
              const categoryProducts = prods;

              const title = formatCategoryTitle(category);
              const subtitle =
                category === "art-de-la-table"
                  ? "Sublimez vos repas avec des accessoires de table raffinés."
                  : category === "nouveautes"
                  ? "Découvrez nos dernières créations."
                  : `Découvrez notre collection de ${title.toLowerCase()}.`;

              return (
                <ProductSection
                  key={category}
                  title={title}
                  subtitle={subtitle}
                  products={categoryProducts}
                  categorySlug={String(category)
                    .toLowerCase()
                    .replace(/\s+/g, "-")}
                  // ⭐️ NEW: center sections that show less than 4 products
                  centerContent={categoryProducts.length < 4}
                  client={client ?? undefined}
                />
              );
            })
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;

