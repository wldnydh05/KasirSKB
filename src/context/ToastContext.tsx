/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

/** Satu toast pill: masuk dari bawah lewat class .tampil (components.css). */
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [tampil, setTampil] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setTampil(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const warna = toast.type === 'success' ? 'sukses' : toast.type === 'error' ? 'bahaya' : '';

  return (
    <div className={`toast ${warna} ${tampil ? 'tampil' : ''} pointer-events-auto flex items-center gap-2.5`} role="status">
      {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
      {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}
      <span className="text-sm">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="p-1 rounded-md opacity-70 hover:opacity-100" aria-label="Tutup">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-wadah">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

