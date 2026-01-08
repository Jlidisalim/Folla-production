/* src/pages/ProductListing.tsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import DotPagination from "@/components/DotPagination";
import { useAuth } from "@clerk/clerk-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import api from "@/lib/api";
import {
  PurchaseUnit,
  resolveListingMinPriceWithFlash,
} from "@/lib/price";
import { trackViewItemList, mapProductToGA4Item } from "@/lib/analytics";
import { ProductListingSkeleton } from "@/components/skeletons";
import ProductFilterBar from "@/components/ProductFilterBar";
import FilterModal from "@/components/FilterModal";
// GEO + SEO imports
import SEOHead, { getBreadcrumbSchema } from "@/components/SEOHead";
import { categoryDescriptions } from "@/components/GEOContentBlocks";

type Product = {
  id: number;
  title: string;
  description?: string;
  category: string;
  subCategory?: string;
  images?: string[];
  pricePiece?: number;
  priceQuantity?: number;
  saleType?: "piece" | "quantity" | "both";
  inStock: boolean;
  displayPrice?: number;
  displayFlashPrice?: number;
  venteFlashActive?: boolean;
  venteFlashPercentage?: number;
  venteFlashPrice?: number;
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | null;
  flashStartAt?: string | null;
  flashEndAt?: string | null;
  availableQuantity?: number;
  shippingPrice?: number | null;
  rating?: number;
  ratingCount?: number;
  minStockAlert?: number;
  combinations?: any[];
};

export type Client = {
  id: number;
  purchaseUnit?: PurchaseUnit;
  clerkId?: string;
  phone?: string;
};

const ProductListing = () => {
  const { category, subCategory } = useParams();
  const { userId, isLoaded: authLoaded } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  // Track if client data has been loaded (prevents price flicker for quantity buyers)
  const [clientLoaded, setClientLoaded] = useState(false);

  const [sortBy, setSortBy] = useState("featured");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 12;

  // Filter modal state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterPriceRange, setFilterPriceRange] = useState<[number, number]>([0, 1000]);
  const [filterSortBy, setFilterSortBy] = useState(sortBy);
  const [filterInStockOnly, setFilterInStockOnly] = useState(inStockOnly);

  const baseURL = (api as any).defaults?.baseURL || "http://localhost:4000";

  // Normalize image path returned by backend into absolute URL
  function normalizeImage(src?: string | null) {
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

  // Reset clientLoaded when auth state changes
  useEffect(() => {
    if (authLoaded && !userId) {
      setClientLoaded(true);
    } else if (!authLoaded) {
      setClientLoaded(false);
    }
  }, [authLoaded, userId]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);

        // 1) fetch client once (optional). Prefer lightweight /clients/current to avoid Clerk auth errors.
        let clientData: Client | null = null;
        if (userId) {
          const fetchClient = async () => {
            try {
              const res = await api.get("/clients/current", {
                params: { clerkId: userId },
              });
              return res.data as Client;
            } catch (err: any) {
              if (err?.response?.status !== 404) {
                console.warn(
                  "ProductListing: /clients/current failed:",
                  err?.response?.data ?? err?.message ?? err
                );
              }
            }
            try {
              const res = await api.get("/clients/me");
              return res.data as Client;
            } catch (err: any) {
              console.warn(
                "ProductListing: /clients/me failed (optional):",
                err?.response?.data ?? err?.message ?? err
              );
              return null;
            }
          };

          clientData = await fetchClient();
          if (mounted) {
            setClient(clientData);
            setClientLoaded(true);
          }
        }

        // 2) fetch products (include clientId/clerkId if available)
        const query = new URLSearchParams();
        if (category) query.append("category", category);
        if (subCategory) query.append("subCategory", subCategory);
        if (clientData?.id) query.append("clientId", String(clientData.id));
        else if (userId) query.append("clerkId", userId);

        console.debug("ProductListing: GET /products?" + query.toString());
        const res = await api.get(`/products?${query.toString()}`);
        const raw: any[] = Array.isArray(res.data) ? res.data : [];

        // normalize images (absolute URLs)
        const normalized = raw.map((p) => ({
          ...p,
          images:
            Array.isArray(p.images) && p.images.length
              ? p.images.map((img: string) => normalizeImage(img))
              : [],
        }));

        if (mounted) setProducts(normalized);
      } catch (err) {
        console.error("❌ Error loading products:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    // Wait for auth to be loaded before starting data fetch
    if (authLoaded) {
      load();
    }
    return () => {
      mounted = false;
    };
  }, [category, subCategory, userId, authLoaded]);

  // Ref to track if we've fired view_item_list for this page
  const hasTrackedViewItemList = useRef(false);

  // GA4: Track view_item_list when products load (no PII - only product identifiers)
  useEffect(() => {
    if (products.length > 0 && !loading && !hasTrackedViewItemList.current) {
      hasTrackedViewItemList.current = true;
      const listId = subCategory
        ? `cat_${category}_${subCategory}`
        : category
          ? `cat_${category}`
          : "all_products";
      const listName = subCategory
        ? `${category} > ${subCategory}`
        : category || "All Products";

      trackViewItemList(
        products.slice(0, 50).map((p, i) =>
          mapProductToGA4Item(
            {
              id: p.id,
              title: p.title,
              category: p.category,
              subCategory: p.subCategory,
              displayPrice: p.displayPrice ?? p.pricePiece ?? p.priceQuantity,
            },
            1,
            undefined,
            i
          )
        ),
        listId,
        listName
      );
    }
  }, [products, loading, category, subCategory]);

  // Reset tracking on category change
  useEffect(() => {
    hasTrackedViewItemList.current = false;
  }, [category, subCategory]);

  const clientUnit: PurchaseUnit =
    client?.purchaseUnit === "quantity" || client?.purchaseUnit === "piece"
      ? client.purchaseUnit
      : "piece";

  const resolveListPrice = (product: Product) =>
    resolveListingMinPriceWithFlash(product, clientUnit);
  const getEffectivePrice = (product: Product) =>
    resolveListPrice(product).price ?? 0;

  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    if (inStockOnly) filtered = filtered.filter((p) => p.inStock);

    if (minPrice || maxPrice) {
      filtered = filtered.filter((p) => {
        const price = getEffectivePrice(p);
        if (minPrice && price < parseFloat(minPrice)) return false;
        if (maxPrice && price > parseFloat(maxPrice)) return false;
        return true;
      });
    }

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
  }, [products, inStockOnly, minPrice, maxPrice, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / productsPerPage)
  );
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );
  const shouldCenterGrid = paginatedProducts.length < 4;
  const gridClasses = `${shouldCenterGrid ? "inline-grid" : "grid w-full"
    } grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 justify-items-center xl:gap-8`;

  const categoryTitle = useMemo(() => {
    if (subCategory)
      return `${subCategory.replace(/-/g, " ").toUpperCase()} (${category})`;
    if (category) return category.replace(/-/g, " ").toUpperCase();
    return "All Products";
  }, [category, subCategory]);

  // Format category for display
  const formatCategoryName = (slug?: string): string => {
    if (!slug) return "Produits";
    const map: Record<string, string> = {
      'decoration': 'Décoration',
      'sacs': 'Sacs & accessoires',
      'art-de-la-table': 'Art de la table',
      'nouveautes': 'Nouveautés',
      'cuisine': 'Cuisine',
    };
    return map[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const displayCategoryName = formatCategoryName(category);
  const categoryDescription = category ? (categoryDescriptions[category] ||
    `Découvrez notre collection ${displayCategoryName.toLowerCase()} artisanale tunisienne. Produits faits main, livraison partout en Tunisie.`) :
    "Tous nos produits artisanaux tunisiens faits main.";

  // Breadcrumbs for JSON-LD
  const breadcrumbs = useMemo(() => {
    const items = [{ name: 'Accueil', url: 'https://follacouffin.tn/' }];
    if (category) {
      items.push({ name: displayCategoryName, url: `https://follacouffin.tn/category/${category}` });
    }
    if (subCategory) {
      items.push({ name: subCategory.replace(/-/g, ' '), url: `https://follacouffin.tn/category/${category}/${subCategory}` });
    }
    return items;
  }, [category, subCategory, displayCategoryName]);

  // Dynamic subcategory fetching from API (same cache as Header)
  const { data: categoryProducts } = useQuery({
    queryKey: ["navCategories"],
    queryFn: async () => {
      const res = await api.get("/products", { params: { limit: 500 } });
      return Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Build dynamic subcategory list from products
  const currentSubCategories = useMemo(() => {
    if (!category || !categoryProducts) return [];

    const subCats = new Set<string>();
    categoryProducts.forEach((p: any) => {
      const catNormalized = p.category?.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-");
      const sub = p.subCategory?.trim();
      if (catNormalized === category && sub) {
        subCats.add(sub);
      }
    });

    return Array.from(subCats).sort();
  }, [category, categoryProducts]);

  // Compute min/max price from products
  const { computedPriceMin, computedPriceMax } = useMemo(() => {
    if (products.length === 0) return { computedPriceMin: 0, computedPriceMax: 1000 };
    const prices = products.map((p) => getEffectivePrice(p)).filter((p) => p > 0);
    if (prices.length === 0) return { computedPriceMin: 0, computedPriceMax: 1000 };
    return {
      computedPriceMin: Math.floor(Math.min(...prices)),
      computedPriceMax: Math.ceil(Math.max(...prices)),
    };
  }, [products]);

  // Update filter price range when products load
  useEffect(() => {
    setFilterPriceRange([computedPriceMin, computedPriceMax]);
  }, [computedPriceMin, computedPriceMax]);

  // Apply filters handler
  const handleApplyFilters = () => {
    setSortBy(filterSortBy);
    setInStockOnly(filterInStockOnly);
    setMinPrice(String(filterPriceRange[0]));
    setMaxPrice(String(filterPriceRange[1]));
    setCurrentPage(1);
  };

  // Reset filters handler
  const handleResetFilters = () => {
    setFilterSortBy("featured");
    setFilterInStockOnly(false);
    setFilterPriceRange([computedPriceMin, computedPriceMax]);
    setSortBy("featured");
    setInStockOnly(false);
    setMinPrice("");
    setMaxPrice("");
    setCurrentPage(1);
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (sortBy !== "featured") count++;
    if (inStockOnly) count++;
    if (minPrice || maxPrice) count++;
    return count;
  }, [sortBy, inStockOnly, minPrice, maxPrice]);

  // Wait for auth to load, data loading, and client data before showing content
  if (!authLoaded || loading || !clientLoaded) {
    return (
      <div className="min-h-screen flex flex-col bg-background" role="status" aria-busy="true">
        <Header products={products} />
        <ProductListingSkeleton />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      {/* SEO Head with Breadcrumb JSON-LD */}
      <SEOHead
        title={`${displayCategoryName} – Artisanat tunisien fait main | FollaCouffin`}
        description={categoryDescription.substring(0, 160)}
        canonicalUrl={`https://follacouffin.tn/category/${category}${subCategory ? `/${subCategory}` : ''}`}
        jsonLd={getBreadcrumbSchema(breadcrumbs)}
      />

      <Header products={products} />

      {/* breadcrumb */}
      <nav className="px-4 py-4 border-b" aria-label="Fil d'Ariane">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-amber-600">
              Accueil
            </Link>
            {category && (
              <>
                <span>/</span>
                <Link
                  to={`/category/${category}`}
                  className="hover:text-amber-600"
                >
                  {displayCategoryName}
                </Link>
              </>
            )}
            {subCategory && <span className="text-amber-700">/ {subCategory.replace(/-/g, ' ')}</span>}
          </div>
        </div>
      </nav>

      {/* Category Title - Modern Design */}
      <div className="py-8 sm:py-12">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            {displayCategoryName}
          </h1>
          <div className="mx-auto mt-3 h-1 w-20 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />
        </div>
      </div>

      {/* Filter Bar */}
      <ProductFilterBar
        subCategories={currentSubCategories}
        selectedSubCategory={subCategory || null}
        onSubCategoryChange={(sub) => {
          if (sub) {
            const slug = sub
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, "-");
            window.location.href = `/category/${category}/${slug}`;
          } else {
            window.location.href = `/category/${category}`;
          }
        }}
        onFilterClick={() => setIsFilterModalOpen(true)}
        activeFiltersCount={activeFiltersCount}
      />

      {/* grid */}
      <div className="max-w-7xl mx-auto px-4 py-6 ">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">
              No products found for "{subCategory || category}"
            </h2>
            <Link to="/" className="text-blue-600 underline">
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className={gridClasses}>
                {paginatedProducts.map((p) => {
                  const priceInfo = resolveListingMinPriceWithFlash(
                    p,
                    clientUnit
                  );
                  const basePriceInfo = resolveListingMinPriceWithFlash(
                    p,
                    clientUnit,
                    { includeFlash: false }
                  );
                  const basePrice = priceInfo.basePrice ?? basePriceInfo.price ?? 0;
                  const effective = priceInfo.price ?? basePrice;
                  const isFlash = priceInfo.flashApplied && effective < basePrice;
                  return (
                    <ProductCard
                      key={p.id}
                      id={p.id}
                      title={p.title}
                      image={
                        Array.isArray(p.images) && p.images.length
                          ? p.images[0]
                          : ""
                      }
                      currentPrice={basePrice}
                      flashPrice={p.displayFlashPrice}
                      pricePiece={p.pricePiece}
                      priceQuantity={p.priceQuantity}
                      combinations={(p as any).combinations}
                      flashPercentage={p.venteFlashPercentage}
                      venteFlashActive={p.venteFlashActive}
                      flashApplyTarget={p.flashApplyTarget}
                      flashApplyAllCombinations={p.flashApplyAllCombinations}
                      flashCombinationIds={p.flashCombinationIds}
                      flashDiscountType={p.flashDiscountType}
                      flashDiscountValue={p.flashDiscountValue}
                      flashStartAt={p.flashStartAt}
                      flashEndAt={p.flashEndAt}
                      inStock={p.inStock}
                      client={client ?? undefined} // <-- PASS THE CLIENT HERE
                      saleType={p.saleType}
                      availableQuantity={p.availableQuantity}
                      shippingPrice={p.shippingPrice ?? undefined}
                      rating={p.rating}
                      ratingCount={p.ratingCount}
                      minStockAlert={p.minStockAlert}
                    />
                  );
                })}
              </div>
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
        )}
      </div>

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

export default ProductListing;
