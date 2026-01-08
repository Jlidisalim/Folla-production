import { Skeleton } from "@/components/ui/skeleton";

/**
 * CartSlideSkeleton - Matches CartSlide layout with cart items
 */
export function CartSlideSkeleton() {
  return (
    <div className="flex flex-col h-full" role="status" aria-busy="true">
      {/* Cart items */}
      <div className="flex-1 overflow-y-auto p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 mb-4 pb-4 border-b">
            {/* Item image */}
            <Skeleton className="w-16 h-16 rounded" />
            
            {/* Item details */}
            <div className="flex-1 space-y-2">
              <div className="flex items-start gap-2">
                <Skeleton className="h-5 w-32 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
              
              {/* Variant */}
              <Skeleton className="h-3 w-24" />
              
              {/* Rating */}
              <div className="flex items-center gap-1">
                <Skeleton className="w-4 h-4 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
              
              {/* Quantity controls */}
              <div className="flex items-center gap-2 mt-2">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="w-6 h-5" />
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t p-4 space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-12 w-full rounded" />
      </div>

      <span className="sr-only">Chargement du panier...</span>
    </div>
  );
}

export default CartSlideSkeleton;
