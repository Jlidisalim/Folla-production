/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import api from "@/lib/api";
import { VenteFlashSkeleton } from "@/components/skeletons";
import ProductFilterBar from "@/components/ProductFilterBar";
import FilterModal from "@/components/FilterModal";
import DotPagination from "@/components/DotPagination";
import { PurchaseUnit } from "@/lib/price";
import SEOHead from "@/components/SEOHead";

type Product = {
  id: number | string;
  title: string;
  images?: string[];
  image?: string;
  category?: string;
  subCategory?: string;
  displayPrice?: number;
  displayFlashPrice?: number;
  venteFlashActive?: boolean;
  venteFlashPercentage?: number;
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | null;
  flashStartAt?: string | null;
  flashEndAt?: string | null;
  pricePiece?: number;
  priceQuantity?: number;
  saleType?: "piece" | "quantity" | "both";
  inStock?: boolean;
  availableQuantity?: number;
  shippingPrice?: number | null;
  rating?: number;
  ratingCount?: number;
  minStockAlert?: number;
};

type Client = {
  id: number;
  purchaseUnit?: PurchaseUnit;
  clerkId?: string;
  phone?: string;
};

const VenteFlashPage: React.FC = () => {
  const { userId, isLoaded: authLoaded } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [flashProducts, setFlashProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  // Filter state
  const [sortBy, setSortBy] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterSortBy, setFilterSortBy] = useState(sortBy);
  const [filterInStockOnly, setFilterInStockOnly] = useState(inStockOnly);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>(priceRange);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  const normalizeImage = (src?: string | null) => {
    if (!src)
      return `${window.location.protocol}//${window.location.host}/placeholder.png`;
    const trimmed = String(src).trim();
    if (!trimmed)
      return `${window.location.protocol}//${window.location.host}/placeholder.png`;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith("/uploads/"))
      return `${baseURL.replace(/\/$/, "")}/products${trimmed}`;
    if (trimmed.startsWith("/products/uploads/"))
      return `${baseURL.replace(/\/$/, "")}${trimmed}`;
    if (trimmed.startsWith("uploads/"))
      return `${baseURL.replace(/\/$/, "")}/products/${trimmed}`;
    return `${baseURL.replace(/\/$/, "")}/products/uploads/${trimmed.replace(
      /^\/+/,
      ""
    )}`;
  };

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
          // No client found, but loading is still done
          if (mounted) setClientLoaded(true);
        }
      }
    };

    fetchClient();
    return () => { mounted = false; };
  }, [authLoaded, userId]);

  // Fetch flash sale products WITH client context (just like ProductListing)
  useEffect(() => {
    if (!authLoaded || !clientLoaded) return;

    let mounted = true;
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const query = new URLSearchParams();
        query.append("venteFlash", "1");
        if (client?.id) query.append("clientId", String(client.id));
        else if (userId) query.append("clerkId", userId);

        const res = await api.get(`/products?${query.toString()}`);
        const raw: Product[] = Array.isArray(res.data) ? res.data : [];

        if (mounted) {
          setFlashProducts(raw);
        }
      } catch (err: any) {
        console.error("Error fetching flash products:", err);
        if (mounted) setError(err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchProducts();
    return () => { mounted = false; };
  }, [authLoaded, clientLoaded, client, userId]);

  const normalized = useMemo(() => {
    return flashProducts.map((product: Product) => {
      const imgs =
        Array.isArray(product.images) && product.images.length
          ? product.images.map((img) => normalizeImage(img))
          : product.image
            ? [normalizeImage(product.image)]
            : [
              `${window.location.protocol}//${window.location.host
              }/placeholder.png`,
            ];
      return {
        ...product,
        images: imgs,
      };
    });
  }, [flashProducts]);

  // Get effective price for a product
  const getEffectivePrice = (product: Product) => {
    return product.displayFlashPrice ?? product.displayPrice ?? product.pricePiece ?? product.priceQuantity ?? 0;
  };

  // Extract unique subcategories from flash products
  const uniqueSubCategories = useMemo(() => {
    const subCats = normalized
      .map((p) => p.subCategory)
      .filter((s): s is string => !!s && s.trim() !== "");
    return Array.from(new Set(subCats)).sort();
  }, [normalized]);

  // Compute min/max price from products
  const { computedPriceMin, computedPriceMax } = useMemo(() => {
    if (normalized.length === 0) return { computedPriceMin: 0, computedPriceMax: 1000 };
    const prices = normalized.map((p) => getEffectivePrice(p)).filter((p) => p > 0);
    if (prices.length === 0) return { computedPriceMin: 0, computedPriceMax: 1000 };
    return {
      computedPriceMin: Math.floor(Math.min(...prices)),
      computedPriceMax: Math.ceil(Math.max(...prices)),
    };
  }, [normalized]);

  // Update filter price range when products load
  useEffect(() => {
    setPriceRange([computedPriceMin, computedPriceMax]);
    setFilterPriceRange([computedPriceMin, computedPriceMax]);
  }, [computedPriceMin, computedPriceMax]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let filtered = [...normalized];

    // Subcategory filter
    if (selectedSubCategory) {
      filtered = filtered.filter((p) => p.subCategory === selectedSubCategory);
    }

    // Stock filter
    if (inStockOnly) {
      filtered = filtered.filter((p) => p.inStock !== false);
    }

    // Price filter
    filtered = filtered.filter((p) => {
      const price = getEffectivePrice(p);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "price-low") {
        return getEffectivePrice(a) - getEffectivePrice(b);
      }
      if (sortBy === "price-high") {
        return getEffectivePrice(b) - getEffectivePrice(a);
      }
      return 0;
    });

    return filtered;
  }, [normalized, selectedSubCategory, inStockOnly, priceRange, sortBy]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );

  // Apply filters handler
  const handleApplyFilters = () => {
    setSortBy(filterSortBy);
    setInStockOnly(filterInStockOnly);
    setPriceRange(filterPriceRange);
    setCurrentPage(1); // Reset to first page when filters change
  };

  // Reset filters handler
  const handleResetFilters = () => {
    setFilterSortBy("featured");
    setFilterInStockOnly(false);
    setFilterPriceRange([computedPriceMin, computedPriceMax]);
    setSortBy("featured");
    setInStockOnly(false);
    setPriceRange([computedPriceMin, computedPriceMax]);
    setCurrentPage(1); // Reset to first page
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (sortBy !== "featured") count++;
    if (inStockOnly) count++;
    if (priceRange[0] !== computedPriceMin || priceRange[1] !== computedPriceMax) count++;
    return count;
  }, [sortBy, inStockOnly, priceRange, computedPriceMin, computedPriceMax]);

  const headerProducts = useMemo(() => {
    return normalized.map((product) => ({
      id: String(product.id),
      title: product.title,
      image: product.images?.[0] ?? "/placeholder.png",
    }));
  }, [normalized]);

  // Full page skeleton when loading auth, products, or client
  if (!authLoaded || isLoading || !clientLoaded) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header products={[]} />
        <VenteFlashSkeleton />
        <Footer />
      </div>
    );
  }

  const content = (() => {
    if (error) {
      return (
        <div className="py-20 text-center text-red-500">
          Impossible de charger les ventes flash pour le moment.
        </div>
      );
    }

    if (!filteredProducts.length) {
      return (
        <div className="py-20 text-center space-y-4">
          <p className="text-2xl font-semibold text-gray-800">
            {normalized.length === 0 ? "Aucune vente flash active" : "Aucun produit ne correspond aux filtres"}
          </p>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {normalized.length === 0
              ? "Revenez plus tard ou inscrivez-vous aux notifications pour ne pas manquer nos prochaines offres."
              : "Essayez de modifier vos critères de filtrage."}
          </p>
          {normalized.length > 0 && (
            <button
              onClick={handleResetFilters}
              className="mt-4 px-6 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      );
    }

    return (
      <>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 justify-items-center xl:gap-8">
          {paginatedProducts.map((product) => (
            <ProductCard
              key={product.id}
              id={product.id}
              title={product.title}
              image={
                product.images && product.images.length > 0
                  ? product.images[0]
                  : ""
              }
              currentPrice={product.displayPrice}
              flashPrice={product.displayFlashPrice}
              pricePiece={product.pricePiece}
              priceQuantity={product.priceQuantity}
              combinations={(product as any).combinations}
              flashPercentage={product.venteFlashPercentage}
              venteFlashActive={product.venteFlashActive}
              flashApplyTarget={product.flashApplyTarget}
              flashApplyAllCombinations={product.flashApplyAllCombinations}
              flashCombinationIds={product.flashCombinationIds}
              flashDiscountType={product.flashDiscountType}
              flashDiscountValue={product.flashDiscountValue}
              flashStartAt={product.flashStartAt}
              flashEndAt={product.flashEndAt}
              saleType={product.saleType}
              inStock={product.inStock}
              client={client ?? undefined}
              availableQuantity={product.availableQuantity}
              shippingPrice={product.shippingPrice ?? undefined}
              rating={product.rating}
              ratingCount={product.ratingCount}
              minStockAlert={product.minStockAlert}
            />
          ))}
        </div>
        {/* Dot-style pagination - only show if more than 12 products */}
        {filteredProducts.length >= 12 && (
          <DotPagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}
      </>
    );
  })();

  return (
    <div className="min-h-screen flex flex-col">
      <SEOHead
        title="Vente Flash – Promotions exceptionnelles | FollaCouffin"
        description="Profitez de remises exceptionnelles sur une sélection limitée de produits artisanaux tunisiens. Offres disponibles jusqu'à épuisement des stocks."
        canonicalUrl="https://follacouffin.tn/vente-flash"
      />
      <Header products={headerProducts} />
      <main className="flex-1 bg-gray-50">
        <section className="bg-muted py-12 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 text-center space-y-4">
            <p className="text-sm uppercase tracking-wide text-orange-500">
              Offres limitées
            </p>
            <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900">
              Vente Flash
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Profitez de remises exceptionnelles sur une sélection limitée de
              produits. Chaque offre est disponible pendant une durée limitée ou
              jusqu'à épuisement des stocks.
            </p>
          </div>
        </section>

        {/* Filter Bar - with subcategories for Vente Flash */}
        <ProductFilterBar
          subCategories={uniqueSubCategories}
          selectedSubCategory={selectedSubCategory}
          onSubCategoryChange={(sub) => {
            setSelectedSubCategory(sub);
            setCurrentPage(1); // Reset to first page when subcategory changes
          }}
          onFilterClick={() => setIsFilterModalOpen(true)}
          activeFiltersCount={activeFiltersCount}
        />

        <section className="max-w-7xl mx-auto px-4 py-12">{content}</section>
      </main>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        sortBy={filterSortBy}
        onSortByChange={setFilterSortBy}
        priceRange={filterPriceRange}
        priceMin={computedPriceMin}
        priceMax={computedPriceMax}
        onPriceRangeChange={setFilterPriceRange}
        inStockOnly={filterInStockOnly}
        onInStockOnlyChange={setFilterInStockOnly}
        resultsCount={filteredProducts.length}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <Footer />
    </div>
  );
};

export default VenteFlashPage;

