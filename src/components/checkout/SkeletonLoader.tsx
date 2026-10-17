export const CheckoutSkeleton = () => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pt-safe-top animate-pulse">
      {/* Header Skeleton */}
      <div className="flex items-center px-4 py-3 border-b border-white/[0.08]/80 bg-slate-900/50">
        <div className="w-11 h-11 bg-slate-800 rounded-xl mr-3" />
        <div className="h-6 w-24 bg-slate-800 rounded" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Cart Summary Skeleton */}
        <div className="rounded-2xl border border-white/[0.08]/80 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-800 rounded-lg" />
              <div className="space-y-2">
                <div className="h-4 w-20 bg-slate-800 rounded" />
                <div className="h-3 w-16 bg-slate-800 rounded" />
              </div>
            </div>
            <div className="h-6 w-24 bg-slate-800 rounded" />
          </div>
        </div>

        {/* Amount Due Skeleton */}
        <div className="rounded-2xl border border-white/[0.08]/20 bg-gradient-to-br from-gray-800/20 to-transparent p-6 text-center">
          <div className="h-4 w-24 bg-slate-800 rounded mx-auto mb-3" />
          <div className="h-12 w-40 bg-slate-800 rounded mx-auto" />
        </div>

        {/* Payment Methods Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-32 bg-slate-800 rounded" />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>

        {/* Input Field Skeleton */}
        <div className="space-y-3">
          <div className="h-4 w-28 bg-slate-800 rounded" />
          <div className="h-14 bg-slate-800 rounded-xl" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 h-10 bg-slate-800 rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions Skeleton */}
      <div className="border-t border-white/[0.08]/80 bg-slate-900/80 p-4 space-y-2">
        <div className="h-14 bg-slate-800 rounded-xl" />
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-slate-800 rounded-xl" />
          <div className="flex-1 h-12 bg-slate-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
};
