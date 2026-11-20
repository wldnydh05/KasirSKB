/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { globalLoading } from '../lib/globalLoading';

export type GlobalLoadingState = 'idle' | 'loading' | 'success' | 'error';

interface GlobalLoadingContextType {
  state: GlobalLoadingState;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextType | null>(null);

export const useGlobalLoading = (): GlobalLoadingContextType => {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }
  return ctx;
};

interface GlobalLoadingProviderProps {
  children: ReactNode;
}

export const GlobalLoadingProvider: React.FC<GlobalLoadingProviderProps> = ({ children }) => {
  const [state, setState] = useState<GlobalLoadingState>('idle');
  const [successTimeout, setSuccessTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [errorTimeout, setErrorTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeouts = useCallback(() => {
    if (successTimeout) clearTimeout(successTimeout);
    if (errorTimeout) clearTimeout(errorTimeout);
    setSuccessTimeout(null);
    setErrorTimeout(null);
  }, [successTimeout, errorTimeout]);

  useEffect(() => {
    const unsubscribe = globalLoading.subscribe((loading, success) => {
      clearTimeouts();
      if (loading) {
        setState('loading');
      } else {
        const nextState = success ? 'success' : 'error';
        setState(nextState);
        // Auto-hide success/error after delay
        if (success) {
          const t = setTimeout(() => setState('idle'), 2000);
          setSuccessTimeout(t);
        } else {
          const t = setTimeout(() => setState('idle'), 3000);
          setErrorTimeout(t);
        }
      }
    });
    return unsubscribe;
  }, [clearTimeouts]);

  return (
    <GlobalLoadingContext.Provider value={{ state }}>
      {children}
    </GlobalLoadingContext.Provider>
  );
};