/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useGlobalLoading } from '../../context/GlobalLoadingContext';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export const GlobalLoadingBar: React.FC = () => {
  const { state } = useGlobalLoading();

  // Only render when not idle
  if (state === 'idle') return null;

  const getConfig = () => {
    switch (state) {
      case 'loading':
        return {
          bg: 'bg-[var(--utama)]',
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: 'Memuat...',
          ariaLabel: 'Data sedang dimuat',
        };
      case 'success':
        return {
          bg: 'bg-[var(--sukses)]',
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Data berhasil dimuat',
          ariaLabel: 'Data berhasil dimuat',
        };
      case 'error':
        return {
          bg: 'bg-[var(--bahaya)]',
          icon: <XCircle className="w-4 h-4" />,
          text: 'Gagal memuat data',
          ariaLabel: 'Gagal memuat data',
        };
    }
  };

  const config = getConfig();

  // Announce to screen readers
  useEffect(() => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = config.text;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }, [state, config.text]);

  // Since we return null for 'idle', state is guaranteed to be 'loading' | 'success' | 'error' here
  return (
    <div
      className={`fixed top-0 right-0 z-[100] flex items-center gap-2 px-4 py-2 text-white text-xs font-medium transition-all duration-300 transform translate-y-0 opacity-100`}
      role="status"
      aria-live="polite"
      aria-label={config.ariaLabel}
    >
      <div
        className={`${config.bg} rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-lg shadow-[var(--utama)]/30`}
      >
        {config.icon}
        <span>{config.text}</span>
      </div>
    </div>
  );
};