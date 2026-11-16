/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-[var(--utama)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[var(--utama-tua)] transition active:scale-95"
        title="Pasang aplikasi S.K.B di perangkat Anda"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--garis-kuat)] bg-[var(--utama-muda)] px-2.5 py-1.5 text-xs font-medium text-[var(--utama-teks)] hover:bg-[var(--utama-muda)] transition"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Pasang di iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-[var(--kartu)] p-5 shadow-2xl animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--garis)]">
                <h3 className="text-base font-bold text-[var(--teks)]">Pasang S.K.B di iPhone/iPad</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-full p-1 text-[var(--redup)] hover:text-[var(--redup)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-3 space-y-3 text-sm text-[var(--redup)]">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--utama-muda)] text-xs font-bold text-[var(--utama-teks)]">
                    1
                  </span>
                  <p>
                    Buka menu di Safari lalu tekan tombol <strong>Bagikan (Share)</strong> di bilah bawah.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--utama-muda)] text-xs font-bold text-[var(--utama-teks)]">
                    2
                  </span>
                  <p>
                    Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--utama-muda)] text-xs font-bold text-[var(--utama-teks)]">
                    3
                  </span>
                  <p>
                    Tekan <strong>Tambah</strong>. S.K.B siap dipakai offline layaknya aplikasi native!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-[var(--utama)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--utama-tua)] transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

