interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle' | 'card' | 'table-row';
}

export const Skeleton = ({ className = '', variant = 'rect' }: SkeletonProps) => {
  const baseClasses = 'shimmer-effect bg-white/[0.06] rounded-xl';

  const variantClasses = {
    text: 'h-4 w-full rounded-md',
    rect: 'h-20 w-full',
    circle: 'h-10 w-10 rounded-full',
    card: 'h-32 w-full rounded-2xl border border-white/[0.06]',
    'table-row': 'h-12 w-full rounded-xl',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} aria-hidden="true" />
  );
};

export const TableSkeleton = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => (
  <div className="bg-slate-900/60 rounded-2xl border border-white/[0.08] overflow-hidden backdrop-blur-md shadow-xl shadow-black/20">
    <div className="flex gap-4 border-b border-white/[0.08] bg-slate-950/50 p-4">
      {Array.from({ length: columns }).map((_, j) => (
        <Skeleton key={j} className="flex-1 h-4" />
      ))}
    </div>
    <div className="p-4 space-y-3 divide-y divide-white/[0.04]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4 pt-3 first:pt-0">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className={`flex-1 ${j === 0 ? 'h-9' : 'h-8'}`} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const CardSkeleton = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} variant="card" />
    ))}
  </div>
);
