// src/components/invoice/invoice-error-boundary.tsx

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component for invoice-related components
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Requirements addressed:
 * - Add error boundaries to React components
 * - Handle errors with user-friendly messages
 * - Log errors for debugging
 * 
 * @example
 * ```tsx
 * <InvoiceErrorBoundary>
 *   <InvoicePreview format={format} />
 * </InvoiceErrorBoundary>
 * ```
 */
export class InvoiceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details for debugging
    console.error('Invoice component error:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="p-6 bg-red-900/20 border border-red-500 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400 mb-2">
                Invoice Display Error
              </h3>
              <p className="text-sm text-gray-300 mb-3">
                We encountered an error while displaying the invoice. This might be due to invalid data or a temporary issue.
              </p>
              {this.state.error && (
                <details className="mb-3">
                  <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                    Error details (for debugging)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded text-xs font-mono text-gray-400 overflow-auto">
                    <div className="mb-2">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                    {this.state.error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 * Note: This is a wrapper around the class-based error boundary
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   return (
 *     <InvoiceErrorBoundaryWrapper>
 *       <InvoicePreview format={format} />
 *     </InvoiceErrorBoundaryWrapper>
 *   );
 * }
 * ```
 */
export function InvoiceErrorBoundaryWrapper({
  children,
  fallback,
  onError,
}: Props): JSX.Element {
  return (
    <InvoiceErrorBoundary fallback={fallback} onError={onError}>
      {children}
    </InvoiceErrorBoundary>
  );
}
