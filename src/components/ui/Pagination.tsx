import { useId } from 'react';
import { type PaginationMeta } from '../../hooks/usePagination';

interface PaginationProps {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  showLimitSelector?: boolean;
  limitOptions?: number[];
}

export const Pagination = ({
  meta,
  onPageChange,
  onLimitChange,
  showLimitSelector = true,
  limitOptions = [10, 20, 50, 100],
}: PaginationProps) => {
  const limitSelectId = useId();

  if (!meta || meta.pages === 0) {
    return null;
  }

  const { page, limit, total, pages, hasNext, hasPrev } = meta;

  // Calculate page range to show
  const getPageNumbers = () => {
    const delta = 2; // Number of pages to show on each side of current page
    const range: (number | string)[] = [];
    
    for (let i = 1; i <= pages; i++) {
      if (
        i === 1 || // First page
        i === pages || // Last page
        (i >= page - delta && i <= page + delta) // Pages around current
      ) {
        range.push(i);
      } else if (range[range.length - 1] !== '...') {
        range.push('...');
      }
    }
    
    return range;
  };

  const pageNumbers = getPageNumbers();
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08]">
      {/* Left: Items info and limit selector */}
      <div className="flex items-center space-x-4">
        <p className="text-sm text-slate-400">
          Showing <span className="font-medium text-white">{startItem}</span> to{' '}
          <span className="font-medium text-white">{endItem}</span> of{' '}
          <span className="font-medium text-white">{total}</span> results
        </p>

        {showLimitSelector && onLimitChange && (
          <div className="flex items-center space-x-2">
            <label htmlFor={limitSelectId} className="text-sm text-slate-400">
              Per page:
            </label>
            <select
              id={limitSelectId}
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="px-3 py-1.5 bg-slate-900/70 border border-white/[0.12] rounded-lg text-white text-sm focus:outline-none focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/40"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center space-x-2">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="px-3 py-2 bg-slate-900/70 border border-white/[0.12] rounded-lg text-slate-200 text-sm hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {pageNumbers.map((pageNum, index) => {
            if (pageNum === '...') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-3 py-2 text-slate-400"
                >
                  ...
                </span>
              );
            }

            const isActive = pageNum === page;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum as number)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-900/70 border border-white/[0.12] text-slate-200 hover:bg-white/[0.06]'
                }`}
                aria-label={`Page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className="px-3 py-2 bg-slate-900/70 border border-white/[0.12] rounded-lg text-slate-200 text-sm hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

/**
 * Compact pagination for mobile or tight spaces
 */
export const CompactPagination = ({
  meta,
  onPageChange,
}: Pick<PaginationProps, 'meta' | 'onPageChange'>) => {
  if (!meta || meta.pages === 0) {
    return null;
  }

  const { page, pages, hasNext, hasPrev } = meta;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08]">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={!hasPrev}
        className="px-4 py-2 bg-slate-900/70 border border-white/[0.12] rounded-lg text-slate-200 text-sm hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      <span className="text-sm text-slate-400">
        Page <span className="font-medium text-white">{page}</span> of{' '}
        <span className="font-medium text-white">{pages}</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={!hasNext}
        className="px-4 py-2 bg-slate-900/70 border border-white/[0.12] rounded-lg text-slate-200 text-sm hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  );
};
