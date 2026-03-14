import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback to render instead of the default UI */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex min-h-[50vh] items-center justify-center p-6"
          style={{ background: 'var(--orbis-page)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-8 text-center"
            style={{
              background: 'var(--orbis-card)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--orbis-border)',
            }}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h2 className="mb-2 text-lg font-semibold text-white">
              Something went wrong
            </h2>

            <p className="mb-4 text-sm text-slate-400">
              An unexpected error occurred. You can try again or reload the page.
            </p>

            {this.state.error && (
              <pre
                className="mb-6 max-h-32 overflow-auto rounded-md p-3 text-left text-xs text-slate-400"
                style={{
                  background: 'var(--orbis-input)',
                  border: '1px solid var(--orbis-border)',
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.resetError}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                style={{
                  background: 'var(--orbis-card)',
                  border: '1px solid var(--orbis-border)',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
