import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DotPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * Modern dot-style pagination component
 * Displays: < • • • • • > Page X / Y
 */
export function DotPagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}: DotPaginationProps) {
  if (totalPages <= 1) return null;

  // Create array of all page numbers
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className={`flex items-center justify-center gap-3 py-6 ${className}`}>
      {/* Previous button */}
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Page précédente"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      {/* Dots - one for each page */}
      <div className="flex items-center gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-3 h-3 rounded-full transition-all duration-200 ${
              page === currentPage
                ? 'bg-gray-700 scale-125'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          />
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-400 hover:text-blue-500 hover:border-blue-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        aria-label="Page suivante"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Page number text */}
      <span className="ml-2 text-sm text-gray-500 font-medium">
        {currentPage} / {totalPages}
      </span>
    </div>
  );
}

export default DotPagination;
