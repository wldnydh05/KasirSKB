/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--latar)] text-[var(--teks)]">
          <div className="bg-[var(--kartu)] rounded-xl p-6 sm:p-8 shadow-sm border border-[var(--garis)] max-w-md w-full text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-[var(--bahaya)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--teks)] mb-2">Terjadi Kesalahan</h2>
            <pre className="text-left text-xs bg-[var(--latar)] p-3 rounded-lg overflow-auto max-h-40 text-[var(--redup)] mb-4">
              {this.state.error?.message || 'Unknown error'}
              {this.state.error?.stack && `\n\n${this.state.error.stack}`}
            </pre>
            <button
              type="button"
              onClick={this.resetError}
              className="w-full py-2.5 px-4 rounded-lg font-medium text-white bg-[var(--utama)] hover:bg-[var(--utama-tua)] transition flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}