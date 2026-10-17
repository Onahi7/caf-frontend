import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
            <div className="max-w-md">
              <h2 className="text-xl font-bold text-slate-100 mb-2">Something went wrong</h2>
              <p className="text-sm text-rose-300 mb-2 break-words">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <p className="text-xs text-slate-500 mb-6">
                You can try again, or reload the app if the problem persists.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => this.setState({ hasError: false, error: undefined })}
                  className="px-4 py-2 rounded-xl border border-white/10 font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 rounded-xl bg-emerald-500 font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                >
                  Reload App
                </button>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}