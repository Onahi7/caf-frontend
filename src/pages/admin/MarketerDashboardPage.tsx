import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { AdminLayout } from "../../components/AdminLayout";
import { MarketerLayout } from "../../components/MarketerLayout";
import apiClient from "../../lib/api-client";
import { unwrapResponse } from "../../lib/unwrap-response";
import { useCurrency } from "../../hooks/useCurrency";
import { queryKeys } from "../../lib/query-keys";
import {
  TrendingUp,
  Package,
  DollarSign,
  ShoppingBag,
  Clock,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

interface MarketerSummary {
  assignedStockValue: number;
  unitsAssigned: number;
  unitsRemaining: number;
  pendingStockValue: number;
  pendingUnits: number;
  soldValue: number;
  unitsSold: number;
  saleCount: number;
}

interface MarketerSalesResponse {
  data: Array<{
    _id: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    soldAt: string;
    productId?: { name?: string; sku?: string };
    customerName?: string;
  }>;
  count: number;
}

export const MarketerDashboardPage = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const { format } = useCurrency();

  const { data: summary, isLoading: summaryLoading } =
    useQuery<MarketerSummary>({
      queryKey: queryKeys.marketer.summary(),
      queryFn: async () => {
        const response = await apiClient.get("/marketer/summary");
        return unwrapResponse(response.data, {} as MarketerSummary);
      },
    });

  const { data: recentSales, isLoading: salesLoading } =
    useQuery<MarketerSalesResponse>({
      queryKey: queryKeys.marketer.sales({ limit: 10 }),
      queryFn: async () => {
        const response = await apiClient.get("/marketer/sales", {
          params: { limit: 10 },
        });
        return unwrapResponse(response.data, {} as MarketerSalesResponse);
      },
    });

  const salesPercentage = summary?.unitsAssigned
    ? Math.round((summary.unitsSold / summary.unitsAssigned) * 100)
    : 0;

  const cards = [
    {
      title: "Assigned Stock Value",
      value: format(summary?.assignedStockValue ?? 0),
      subtitle: `${summary?.unitsAssigned ?? 0} total units`,
      icon: <Package className="w-6 h-6" />,
      tone: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
    },
    {
      title: "Sales Value",
      value: format(summary?.soldValue ?? 0),
      subtitle: `${summary?.saleCount ?? 0} completed sales`,
      icon: <DollarSign className="w-6 h-6" />,
      tone: "text-green-400",
      bg: "bg-green-500/10 border-green-500/20",
      highlight: true,
    },
    {
      title: "Units Sold",
      value: `${summary?.unitsSold ?? 0}`,
      subtitle: `${salesPercentage}% of assigned stock`,
      icon: <ShoppingBag className="w-6 h-6" />,
      tone: "text-indigo-400",
      bg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      title: "Units Remaining",
      value: `${summary?.unitsRemaining ?? 0}`,
      subtitle: "Available for next sales",
      icon: <Package className="w-6 h-6" />,
      tone: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Pending Assignments",
      value: format(summary?.pendingStockValue ?? 0),
      subtitle: `${summary?.pendingUnits ?? 0} units awaiting acceptance`,
      icon: <Clock className="w-6 h-6" />,
      tone: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      action: (summary?.pendingUnits ?? 0) > 0,
    },
  ];

  const content = (
    <div className="space-y-6">
      {/* Welcome Header */}
        <div className="card-compact">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="heading-3">Sales Performance</h2>
              <p className="body-sm mt-1">
                Track your assignments and sales activity
              </p>
            </div>
            {(summary?.pendingUnits ?? 0) > 0 && (
              <Link
                to="/marketer/review"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {summary?.pendingUnits ?? 0} pending
                </span>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`
                rounded-xl border p-5 transition-all hover:scale-[1.02]
                ${card.bg}
                ${card.highlight ? "ring-2 ring-green-500/30" : ""}
              `}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-white/10 ${card.tone}`}>
                  {card.icon}
                </div>
                {card.action && (
                  <Link to="/marketer/review">
                    <AlertCircle className="w-5 h-5 text-purple-400 animate-pulse" />
                  </Link>
                )}
              </div>
              <p className="body-sm mb-2">{card.title}</p>
              <p className={`text-2xl font-bold mb-1 ${card.tone}`}>
                {summaryLoading ? (
                  <span className="inline-block w-20 h-8 bg-white/10 rounded animate-pulse" />
                ) : (
                  card.value
                )}
              </p>
              <p className="text-xs text-gray-400">{card.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Progress Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Progress */}
          <div className="card-compact">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h3 className="heading-4">Sales Progress</h3>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-300">Units Sold</span>
                  <span className="text-sm font-semibold text-green-400">
                    {summary?.unitsSold || 0} / {summary?.unitsAssigned || 0}
                  </span>
                </div>
                <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${salesPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {salesPercentage}% of assigned stock sold
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Total Sales</p>
                  <p className="text-lg font-bold text-white">
                    {summary?.saleCount || 0}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">Avg Sale Value</p>
                  <p className="text-lg font-bold text-accent-green">
                    {(summary?.saleCount ?? 0) > 0
                      ? format(
                          (summary?.soldValue || 0) / (summary?.saleCount ?? 1),
                        )
                      : format(0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card-compact">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="w-5 h-5 text-blue-400" />
              <h3 className="heading-4">Quick Actions</h3>
            </div>
            <div className="space-y-3">
              <Link
                to="/marketer/sales"
                className="flex items-center justify-between p-4 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <ShoppingBag className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Record Sale</p>
                    <p className="text-xs text-gray-400">
                      Log a new sale transaction
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-green-400 group-hover:translate-x-1 transition-transform" />
              </Link>

              {(summary?.pendingUnits ?? 0) > 0 && (
                <Link
                  to="/marketer/review"
                  className="flex items-center justify-between p-4 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors group relative"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20 relative">
                      <Clock className="w-5 h-5 text-purple-400" />
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        Review Assignments
                      </p>
                      <p className="text-xs text-gray-400">
                        {summary?.pendingUnits ?? 0} units pending acceptance
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              )}

              <Link
                to="/marketer/history"
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/10">
                    <CheckCircle className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">View History</p>
                    <p className="text-xs text-gray-400">
                      Review past sales and assignments
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Sales */}
        <div className="card-compact">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-accent-green" />
              <h3 className="heading-4">Recent Sales</h3>
            </div>
            <Link
              to="/marketer/sales"
              className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {salesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/10 p-4 animate-pulse"
                >
                  <div className="h-4 w-32 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-48 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          ) : (recentSales?.data || []).length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-lg border border-dashed border-white/10">
              <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">No sales yet</p>
              <p className="text-sm text-gray-500">
                Start by creating a sale from your assigned products
              </p>
              <Link
                to="/marketer/sales"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                Record First Sale
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {(recentSales?.data || []).slice(0, 5).map((sale) => (
                <div
                  key={sale._id}
                  className="rounded-lg border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white mb-1">
                        {sale.productId?.name || "Assigned Product"}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          Qty {sale.quantity}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(sale.soldAt).toLocaleDateString()}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">
                          {new Date(sale.soldAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="text-right sm:pl-4">
                      <p className="text-lg font-bold text-accent-green">
                        {format(sale.totalAmount)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(sale.unitPrice)} per unit
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );

  if (isAdminRoute) {
    return (
      <AdminLayout title="Marketer Performance Dashboard">
        {content}
      </AdminLayout>
    );
  }

  return (
    <MarketerLayout title="My Sales Dashboard">
      {content}
    </MarketerLayout>
  );
};
