// src/components/ProductSection.tsx
import ProductCard, { Client } from "./ProductCard";
import { Link } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";

interface Product {
  id: number | string;
  title: string;
  image: string;
  currentPrice?: number | string;
  displayPrice?: number | string;
  displayFlashPrice?: number | string;
  pricePiece?: number;
  priceQuantity?: number;
  combinations?: any[];
  venteFlashPercentage?: number | string;
  venteFlashActive?: boolean;
  flashApplyTarget?: "product" | "combinations";
  flashApplyAllCombinations?: boolean;
  flashCombinationIds?: string[];
  flashDiscountType?: "percent" | "fixed";
  flashDiscountValue?: number | string | null;
  flashStartAt?: string | Date | null;
  flashEndAt?: string | Date | null;
  saleType?: "piece" | "quantity" | "both";
  availableQuantity?: number;
  inStock?: boolean;
  rating?: number;
  ratingCount?: number;
  minStockAlert?: number;
}

interface ProductSectionProps {
  title: string;
  subtitle?: string;
  products: Product[];
  showViewAll?: boolean;
  categorySlug?: string;
  centerContent?: boolean;
  client?: Client;
}

const ProductSection = ({
  title,
  subtitle,
  products,
  showViewAll = true,
  categorySlug,
  centerContent = false,
  client,
}: ProductSectionProps) => {
  // Always use carousel for desktop when there are 2+ products (arrows will be disabled when nothing to scroll)
  const shouldUseCarousel = products.length >= 2;
  const fewProducts =
    !shouldUseCarousel && centerContent && products.length === 1;
  // Always show arrows for visual consistency (carousel will disable them when nothing to scroll)
  const showArrows = true;

  return (
    <section className="py-12 px-4 overflow-visible">
      <div className="max-w-[2400px] mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-3 rounded-full bg-gradient-to-r from-orange-100 via-amber-50 to-orange-100 text-orange-700 text-xs font-semibold uppercase tracking-[0.2em] shadow-sm">
            Collection
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            {title}
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-orange-400 via-amber-500 to-orange-600" />
          {subtitle && (
            <p className="mt-3 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>

        {shouldUseCarousel ? (
          <>
            {/* Mobile/Tablet Grid - 2 cards per row, hidden on lg+ */}
            <div className="lg:hidden grid grid-cols-2 gap-3 sm:gap-4 justify-items-center">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  image={product.image}
                  currentPrice={product.displayPrice ?? product.currentPrice}
                  flashPrice={product.displayFlashPrice}
                  pricePiece={product.pricePiece}
                  priceQuantity={product.priceQuantity}
                  combinations={product.combinations}
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
                  availableQuantity={product.availableQuantity}
                  rating={product.rating}
                  ratingCount={product.ratingCount}
                  minStockAlert={product.minStockAlert}
                  client={client}
                />
              ))}
            </div>

            {/* Desktop Carousel - hidden below lg */}
            <div className="hidden lg:block relative">
              <Carousel
                opts={{
                  align: products.length <= 5 ? "center" : "start",
                  loop: products.length > 5,
                  slidesToScroll: 1,
                  containScroll: "trimSnaps",
                }}
                className="pb-12"
              >
                <CarouselContent className={`-ml-4 ${products.length <= 5 ? 'justify-center' : ''}`}>
                  {products.map((product) => (
                    <CarouselItem
                      key={product.id}
                      className="pl-4 lg:basis-1/5"
                    >
                      <ProductCard
                        id={product.id}
                        title={product.title}
                        image={product.image}
                        currentPrice={product.displayPrice ?? product.currentPrice}
                        flashPrice={product.displayFlashPrice}
                        pricePiece={product.pricePiece}
                        priceQuantity={product.priceQuantity}
                        combinations={product.combinations}
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
                        availableQuantity={product.availableQuantity}
                        rating={product.rating}
                        ratingCount={product.ratingCount}
                        minStockAlert={product.minStockAlert}
                        client={client}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {showArrows && (
                  <>
                    <CarouselPrevious className="left-2 lg:left-4 bg-white/95 text-gray-800 shadow-md border border-gray-200 hover:bg-white hover:text-black" />
                    <CarouselNext className="right-2 lg:right-4 bg-white/95 text-gray-800 shadow-md border border-gray-200 hover:bg-white hover:text-black" />
                  </>
                )}
              </Carousel>
            </div>
          </>
        ) : fewProducts ? (
          <div className="flex flex-wrap justify-center gap-10">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                image={product.image}
                currentPrice={product.displayPrice ?? product.currentPrice}
                flashPrice={product.displayFlashPrice}
                pricePiece={product.pricePiece}
                priceQuantity={product.priceQuantity}
                combinations={product.combinations}
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
                availableQuantity={product.availableQuantity}
                rating={product.rating}
                ratingCount={product.ratingCount}
                minStockAlert={product.minStockAlert}
                client={client}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 justify-items-center">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                image={product.image}
                currentPrice={product.displayPrice ?? product.currentPrice}
                flashPrice={product.displayFlashPrice}
                pricePiece={product.pricePiece}
                priceQuantity={product.priceQuantity}
                combinations={product.combinations}
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
                availableQuantity={product.availableQuantity}
                rating={product.rating}
                ratingCount={product.ratingCount}
                minStockAlert={product.minStockAlert}
                client={client}
              />
            ))}
          </div>
        )}

        {showViewAll && (
          <div className="text-center mt-8">
            {categorySlug ? (
              <Link to={`/category/${categorySlug}`}>
                <button className="bg-black text-white py-2 px-6 rounded-none transform transition-transform duration-200 hover:scale-105">
                  Tout afficher
                </button>
              </Link>
            ) : (
              <button className="bg-black text-white py-2 px-6 rounded-none transform transition-transform duration-200 hover:scale-105">
                Tout afficher
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductSection;
