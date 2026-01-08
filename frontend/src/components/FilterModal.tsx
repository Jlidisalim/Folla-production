// components/FilterModal.tsx
import React, { useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Sort
  sortBy: string;
  onSortByChange: (value: string) => void;
  // Price
  priceRange: [number, number];
  priceMin: number;
  priceMax: number;
  onPriceRangeChange: (range: [number, number]) => void;
  // Stock
  inStockOnly: boolean;
  onInStockOnlyChange: (value: boolean) => void;
  // Results
  resultsCount: number;
  onApply: () => void;
  onReset: () => void;
}

const FilterModal: React.FC<FilterModalProps> = ({
  isOpen,
  onClose,
  sortBy,
  onSortByChange,
  priceRange,
  priceMin,
  priceMax,
  onPriceRangeChange,
  inStockOnly,
  onInStockOnlyChange,
  resultsCount,
  onApply,
  onReset,
}) => {
  // Collapsible section states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sort: true,
    price: true,
    availability: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handlePriceMinChange = (value: number) => {
    onPriceRangeChange([Math.min(value, priceRange[1]), priceRange[1]]);
  };

  const handlePriceMaxChange = (value: number) => {
    onPriceRangeChange([priceRange[0], Math.max(value, priceRange[0])]);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-50"
            onClick={onClose}
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.3 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 flex flex-col shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Filtrer par</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Classer par (Sort) */}
              <div className="border-b pb-4 mb-4">
                <button
                  onClick={() => toggleSection("sort")}
                  className="flex items-center justify-between w-full text-left font-medium py-2"
                >
                  <span>Classer par</span>
                  {expandedSections.sort ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.sort && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 pt-3">
                        <button
                          onClick={() => onSortByChange("price-low")}
                          className={`px-4 py-2 text-sm rounded-md border transition-all ${
                            sortBy === "price-low"
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          Prix Par Ordre Croissant
                        </button>
                        <button
                          onClick={() => onSortByChange("price-high")}
                          className={`px-4 py-2 text-sm rounded-md border transition-all ${
                            sortBy === "price-high"
                              ? "bg-black text-white border-black"
                              : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          Prix Par Ordre Décroissant
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Prix (Price) */}
              <div className="border-b pb-4 mb-4">
                <button
                  onClick={() => toggleSection("price")}
                  className="flex items-center justify-between w-full text-left font-medium py-2"
                >
                  <span>Prix</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">
                      {priceRange[0]}TND – {priceRange[1]}TND
                    </span>
                    {expandedSections.price ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>
                <AnimatePresence>
                  {expandedSections.price && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-4 space-y-4">
                        {/* Min Price Slider */}
                        <div>
                          <label className="text-sm text-gray-600 mb-2 block">
                            Prix minimum: {priceRange[0]} TND
                          </label>
                          <input
                            type="range"
                            min={priceMin}
                            max={priceMax}
                            value={priceRange[0]}
                            onChange={(e) => handlePriceMinChange(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                          />
                        </div>
                        {/* Max Price Slider */}
                        <div>
                          <label className="text-sm text-gray-600 mb-2 block">
                            Prix maximum: {priceRange[1]} TND
                          </label>
                          <input
                            type="range"
                            min={priceMin}
                            max={priceMax}
                            value={priceRange[1]}
                            onChange={(e) => handlePriceMaxChange(Number(e.target.value))}
                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Disponibilité (Availability) */}
              <div className="pb-4">
                <button
                  onClick={() => toggleSection("availability")}
                  className="flex items-center justify-between w-full text-left font-medium py-2"
                >
                  <span>Disponibilité</span>
                  {expandedSections.availability ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                <AnimatePresence>
                  {expandedSections.availability && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 space-y-3">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={inStockOnly}
                            onChange={(e) => onInStockOnlyChange(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-300 text-black focus:ring-black accent-black"
                          />
                          <span className="text-sm">En stock uniquement</span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t px-6 py-4 flex items-center gap-3">
              <button
                onClick={() => {
                  onApply();
                  onClose();
                }}
                className="flex-1 bg-black text-white py-3 px-6 rounded-md font-medium hover:bg-gray-800 transition-colors"
              >
                Voir {resultsCount} article{resultsCount !== 1 ? "s" : ""}
              </button>
              <button
                onClick={onReset}
                className="px-6 py-3 text-sm text-gray-600 hover:text-black border border-gray-300 rounded-md hover:border-gray-400 transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FilterModal;
