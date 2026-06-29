'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  onError?: (error: Error) => void;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
          <h4 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong loading this section.</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
             An unexpected error occurred. You can try reloading this section or head back to the main dashboard.
          </p>
          {this.state.error && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, textAlign: 'left', fontFamily: 'monospace', fontSize: 12, color: '#ef4444', wordBreak: 'break-word' }}>
              <strong>Error:</strong> {this.state.error.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
               className="btn btn-primary btn-sm"
               onClick={() => this.setState({ hasError: false, error: undefined })}
            >
              Try again
            </button>
            <a href="/dashboard" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              Go to dashboard
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
