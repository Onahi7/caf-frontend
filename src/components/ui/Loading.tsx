interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  variant?: 'spinner' | 'text' | 'centered';
}

export const Loading = ({
  size = 'md',
  text,
  fullScreen = false,
  variant = 'spinner',
}: LoadingProps) => {
  const label = text || 'Loading…';

  if (variant === 'text') {
    return (
      <div className="flex items-center justify-center gap-2.5 p-4 text-sm text-slate-300 animate-fade-in" role="status" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" aria-hidden="true" />
        <span className="font-medium tracking-tight">{label}</span>
      </div>
    );
  }

  if (variant === 'centered') {
    return (
      <div className="min-h-72 space-y-5 px-1 py-4 animate-fade-in" role="status" aria-live="polite" aria-busy="true">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-44 shimmer-effect rounded-xl bg-white/10" />
            <div className="h-3 w-64 max-w-[65vw] shimmer-effect rounded bg-white/5" />
          </div>
          <div className="h-10 w-28 shimmer-effect rounded-xl bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-28 shimmer-effect rounded-2xl border border-white/[0.06] bg-slate-900/60" />
          ))}
        </div>
        <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-slate-900/40 p-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex gap-4">
              <div className="h-11 w-11 shrink-0 shimmer-effect rounded-xl bg-white/10" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-2/5 shimmer-effect rounded bg-white/10" />
                <div className="h-3 w-3/4 shimmer-effect rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  const skeleton = (
    <div className="w-full space-y-3.5 animate-fade-in" role="status" aria-live="polite" aria-busy="true">
      <div className="h-5 w-1/3 shimmer-effect rounded-lg bg-white/10" />
      <div className="h-3 w-4/5 shimmer-effect rounded bg-white/5" />
      <div className="h-3 w-2/3 shimmer-effect rounded bg-white/5" />
      <div className={`${size === 'sm' ? 'h-14' : size === 'lg' ? 'h-36' : 'h-24'} shimmer-effect rounded-2xl border border-white/[0.06] bg-slate-900/60`} />
      <span className="sr-only">{label}</span>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
        <div className="w-full max-w-3xl px-6">{skeleton}</div>
      </div>
    );
  }

  return skeleton;
};
