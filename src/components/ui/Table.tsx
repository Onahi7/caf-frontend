import { type ReactNode, useState, useEffect, useMemo } from "react";
import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Download, Inbox, LayoutGrid, List } from "lucide-react";
import { type PaginationMeta } from "../../hooks/usePagination";
import { Pagination } from "./Pagination";

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  render?: (item: T) => ReactNode;
  className?: string;
  /** Show this column in mobile card view (defaults to true) */
  mobileVisible?: boolean;
  /** Make this the primary field in mobile cards */
  mobilePrimary?: boolean;
}

interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  emptyMessage?: string;
  isLoading?: boolean;
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onSort?: (key: string) => void;
  currentSort?: { key: string; order: "asc" | "desc" };
  rowKey?: (item: T) => string;
  onRowClick?: (item: T) => void;
  /** Enable mobile card view (defaults to true) */
  mobileCardView?: boolean;
  /** Allow toggling between Card and Table on mobile (defaults to true) */
  showViewToggle?: boolean;
  /** If provided, renders an Export CSV button in the table toolbar */
  exportFilename?: string;
  /** Optional title displayed in table header toolbar */
  title?: string;
}

export const Table = <T extends Record<string, any>>({
  data,
  columns,
  emptyMessage = "No data available",
  isLoading = false,
  pagination,
  onPageChange,
  onLimitChange,
  onSort,
  currentSort,
  rowKey = (item) => item._id ?? item.id ?? "unknown",
  onRowClick,
  mobileCardView = true,
  showViewToggle = true,
  exportFilename,
  title,
}: TableProps<T>) => {
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMode, setMobileMode] = useState<"card" | "table">("card");
  const [internalSort, setInternalSort] = useState<{ key: string; order: "asc" | "desc" } | null>(null);

  // Active sort state (delegates to currentSort if controlled from parent, else internalSort)
  const activeSort = currentSort !== undefined ? currentSort : internalSort;

  // Detect mobile viewport (< 768px)
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const isActionColumn = (col: TableColumn<T>) => {
    return (
      col.key === "actions" ||
      col.key === "action" ||
      col.header.toLowerCase().includes("action")
    );
  };

  const isStatusColumn = (col: TableColumn<T>) => {
    return (
      col.key === "status" ||
      col.header.toLowerCase().includes("status")
    );
  };

  const isColumnSortable = (col: TableColumn<T>) => {
    if (col.sortable !== undefined) return col.sortable;
    // By default, non-action columns are sortable
    return !isActionColumn(col);
  };

  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key);
      return;
    }
    setInternalSort((prev) => {
      if (prev?.key === key) {
        return prev.order === "asc" ? { key, order: "desc" } : null;
      }
      return { key, order: "asc" };
    });
  };

  const getAlignmentClass = (align?: "left" | "center" | "right") => {
    if (align === "right") return "text-right justify-end";
    if (align === "center") return "text-center justify-center";
    return "text-left justify-start";
  };

  // Ensure data is always an array
  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Built-in client-side sorting when onSort is not provided
  const sortedData = useMemo(() => {
    if (!activeSort || onSort) return safeData;
    const { key, order } = activeSort;
    return [...safeData].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return order === "asc" ? valA - valB : valB - valA;
      }
      if (typeof valA === "boolean" && typeof valB === "boolean") {
        return order === "asc" ? (valA ? -1 : 1) : (valA ? 1 : -1);
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return order === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [safeData, activeSort, onSort]);

  // Client-side CSV export
  const handleExportCSV = () => {
    const exportColumns = columns.filter((col) => !isActionColumn(col));
    const headerRow = exportColumns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(",");
    const bodyRows = sortedData.map((item) => {
      return exportColumns
        .map((c) => {
          const val = item[c.key];
          if (val == null) return '""';
          if (typeof val === "object") {
            const nested = val.name || val.title || val.code || val.label || JSON.stringify(val);
            return `"${String(nested).replace(/"/g, '""')}"`;
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",");
    });
    const csvContent = [headerRow, ...bodyRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const cleanName = (exportFilename || "table-export").replace(/[^a-z0-9_-]/gi, "-");
    link.download = `${cleanName}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    const skeletonCols = Math.min(columns.length || 4, 6);
    return (
      <div className="bg-slate-900/60 rounded-2xl border border-white/[0.08] backdrop-blur-md overflow-hidden shadow-xl shadow-black/20">
        <div className="flex gap-4 border-b border-white/[0.08] bg-slate-950/50 px-4 py-3.5 sm:px-6" aria-hidden="true">
          {Array.from({ length: skeletonCols }).map((_, i) => (
            <div key={i} className="h-3.5 min-w-16 flex-1 animate-pulse rounded bg-white/10" />
          ))}
        </div>
        <div className="divide-y divide-white/[0.06]" role="status" aria-live="polite" aria-busy="true">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="flex gap-4 px-4 py-4 sm:px-6">
              {Array.from({ length: skeletonCols }).map((_, index) => (
                <div
                  key={index}
                  className={`h-4 flex-1 animate-pulse rounded ${index === 0 ? "bg-white/10" : "bg-white/5"}`}
                />
              ))}
            </div>
          ))}
          <span className="sr-only">Loading table data…</span>
        </div>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="bg-slate-900/60 rounded-2xl border border-white/[0.08] backdrop-blur-md overflow-hidden shadow-xl shadow-black/20">
        <div className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 mb-3">
            <Inbox className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">{emptyMessage}</p>
          <p className="text-xs text-slate-500 mt-1">No records match the current criteria</p>
        </div>
      </div>
    );
  }

  // Identify specialized columns for mobile card layout
  const actionColumn = columns.find((col) => isActionColumn(col));
  const statusColumn = columns.find((col) => isStatusColumn(col));

  const primaryColumn =
    columns.find((col) => col.mobilePrimary) ||
    columns.find((col) => col.key !== actionColumn?.key && col.key !== statusColumn?.key) ||
    columns[0];

  const mobileDataColumns = columns.filter(
    (col) =>
      col.key !== primaryColumn?.key &&
      col.key !== actionColumn?.key &&
      col.key !== statusColumn?.key &&
      col.mobileVisible !== false
  );

  // Common Header Toolbar (Title, Count, Export, Mobile Toggle)
  const renderToolbar = () => {
    const hasToolbarContent = exportFilename || title || (isMobile && showViewToggle);
    if (!hasToolbarContent) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950/50 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {title && <span className="text-sm font-semibold text-white tracking-tight">{title}</span>}
          <span className="text-xs text-slate-400 font-medium bg-white/[0.04] px-2.5 py-0.5 rounded-full border border-white/[0.06]">
            {sortedData.length} {sortedData.length === 1 ? "record" : "records"}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {exportFilename && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white border border-white/[0.08] transition-colors shadow-xs active:scale-[0.98]"
              title="Export records to CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          )}
          {isMobile && showViewToggle && (
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setMobileMode("card")}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  mobileMode === "card"
                    ? "bg-emerald-500/20 text-emerald-300 shadow-xs border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileMode("table")}
                className={`px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  mobileMode === "table"
                    ? "bg-emerald-500/20 text-emerald-300 shadow-xs border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render Mobile Card View
  if (isMobile && mobileCardView && mobileMode === "card") {
    return (
      <div className="bg-slate-900/60 rounded-2xl border border-white/[0.08] backdrop-blur-md overflow-hidden shadow-xl shadow-black/20">
        {renderToolbar()}

        <div className="divide-y divide-white/[0.06]">
          {sortedData.map((item) => (
            <div
              key={rowKey(item)}
              onClick={() => onRowClick?.(item)}
              className={`p-4 transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06]"
                  : ""
              }`}
            >
              {/* Header: Primary identifier + Status Badge */}
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm sm:text-base font-semibold text-white leading-snug">
                    {primaryColumn.render
                      ? primaryColumn.render(item)
                      : (item[primaryColumn.key] ?? "-")}
                  </div>
                </div>
                {statusColumn && (
                  <div className="shrink-0">
                    {statusColumn.render
                      ? statusColumn.render(item)
                      : (item[statusColumn.key] ?? null)}
                  </div>
                )}
              </div>

              {/* Body: Informative Fields */}
              {mobileDataColumns.length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mt-2 text-xs">
                  {mobileDataColumns.map((column) => (
                    <div key={column.key} className="min-w-0">
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-0.5">
                        {column.header}
                      </div>
                      <div className="text-sm text-slate-200 truncate">
                        {column.render
                          ? column.render(item)
                          : (item[column.key] ?? "-")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer: Dedicated Actions Bar */}
              {actionColumn && (
                <div
                  className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-end gap-2 flex-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actionColumn.render
                    ? actionColumn.render(item)
                    : (item[actionColumn.key] ?? null)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {pagination && onPageChange && (
          <Pagination
            meta={pagination}
            onPageChange={onPageChange}
            onLimitChange={onLimitChange}
          />
        )}
      </div>
    );
  }

  // Desktop or Mobile Table (Horizontal Scroll) View
  return (
    <div className="bg-slate-900/60 rounded-2xl border border-white/[0.08] backdrop-blur-md overflow-hidden shadow-xl shadow-black/20">
      {renderToolbar()}

      <div className="relative">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/[0.06]">
            <thead className="bg-slate-950/60">
              <tr>
                {columns.map((column) => {
                  const sortable = isColumnSortable(column);
                  const alignClass = getAlignmentClass(column.align);
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={`px-4 py-3.5 sm:px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider ${
                        sortable
                          ? "cursor-pointer hover:text-white select-none transition-colors"
                          : ""
                      } ${column.className || ""}`}
                      onClick={() => sortable && handleSort(column.key)}
                    >
                      <div className={`flex items-center space-x-1.5 ${alignClass}`}>
                        <span>{column.header}</span>
                        {sortable && (
                          <span className="text-slate-500">
                            {activeSort?.key === column.key ? (
                              activeSort.order === "asc" ? (
                                <ChevronUp className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {sortedData.map((item) => (
                <tr
                  key={rowKey(item)}
                  onClick={() => onRowClick?.(item)}
                  className={`transition-colors ${
                    onRowClick
                      ? "cursor-pointer hover:bg-white/[0.03] active:bg-white/[0.06]"
                      : "hover:bg-white/[0.015]"
                  }`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3.5 sm:px-6 text-sm text-slate-200 ${
                        column.align === "right"
                          ? "text-right"
                          : column.align === "center"
                          ? "text-center"
                          : "text-left"
                      } ${column.className || ""}`}
                    >
                      {column.render
                        ? column.render(item)
                        : (item[column.key] ?? "-")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <Pagination
          meta={pagination}
          onPageChange={onPageChange}
          onLimitChange={onLimitChange}
        />
      )}
    </div>
  );
};
