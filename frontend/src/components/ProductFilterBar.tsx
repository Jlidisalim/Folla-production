// components/ProductFilterBar.tsx
import React from "react";
import { SlidersHorizontal } from "lucide-react";

interface ProductFilterBarProps {
  subCategories?: string[];
  selectedSubCategory?: string | null;
  onSubCategoryChange?: (sub: string | null) => void;
  onFilterClick: () => void;
  activeFiltersCount?: number;
}

const ProductFilterBar: React.FC<ProductFilterBarProps> = ({
  subCategories = [],
  selectedSubCategory,
  onSubCategoryChange,
  onFilterClick,
  activeFiltersCount = 0,
}) => {
  const hasSubCategories = subCategories.length > 0;

  return (
    <div className={`bg-white ${hasSubCategories ? 'border-b' : ''}`}>
      {/* Mobile: Filter button on separate row */}
      <div className="flex justify-end px-4 py-2 md:hidden">
        <button
          onClick={onFilterClick}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-black border border-gray-300 rounded-md hover:border-gray-400 transition-all whitespace-nowrap bg-white"
        >
          <span>Filtrer par</span>
          <SlidersHorizontal className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="ml-1 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Subcategory tabs row */}
      {hasSubCategories && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-2 gap-4">
            {/* Spacer for balance on desktop */}
            <div className="hidden md:block w-[120px]" />

            {/* Subcategory tabs - horizontal scroll without visible scrollbar */}
            <div
              className="flex-1 overflow-x-auto min-w-0"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <div className="flex items-center justify-center gap-1 min-w-max hide-scrollbar">
                {/* "Tout afficher" tab */}
                <button
                  onClick={() => onSubCategoryChange?.(null)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-sm ${!selectedSubCategory
                      ? "text-black"
                      : "text-gray-500 hover:text-black"
                    }`}
                >
                  Tout afficher
                </button>

                {/* Subcategory tabs */}
                {subCategories.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => onSubCategoryChange?.(sub)}
                    className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-all rounded-sm ${selectedSubCategory === sub
                        ? "text-black"
                        : "text-gray-500 hover:text-black"
                      }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: Filter button at far right */}
            <div className="hidden md:block flex-shrink-0">
              <button
                onClick={onFilterClick}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-black border border-gray-300 rounded-md hover:border-gray-400 transition-all whitespace-nowrap bg-white"
              >
                <span>Filtrer par</span>
                <SlidersHorizontal className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <span className="ml-1 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No subcategories: just filter button (desktop only, mobile already has it above) */}
      {!hasSubCategories && (
        <div className="hidden md:flex justify-end px-4 py-3">
          <button
            onClick={onFilterClick}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-black border border-gray-300 rounded-md hover:border-gray-400 transition-all whitespace-nowrap bg-white"
          >
            <span>Filtrer par</span>
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="ml-1 bg-black text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductFilterBar;
