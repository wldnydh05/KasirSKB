/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTema } from '../../hooks/useTema';
import { OfflineBadge } from './OfflineBadge';

export type NavTab =
  | 'kasir'
  | 'riwayat'
  | 'dashboard'
  | 'terlaris'
  | 'biaya'
  | 'menu'
  | 'ekspor';

/**
 * Tab dikelompokkan per role (nav hanya menampilkan kelompok):
 * Owner: Laporan (dashboard+terlaris) · Produk (menu) · Riwayat · Laba/Rugi (biaya+ekspor)
 * Kasir: Kasir (POS) · Produk (hanya ubah status Tersedia/Habis) · Riwayat
 * Sub-halaman dalam kelompok dipilih lewat .segmen di App.tsx.
 * Navigasinya sendiri dirender oleh Sidebar (desktop) & BottomNav (mobile).
 */
export const grupTab: Record<string, NavTab[]> = {
  laporan: ['dashboard', 'terlaris'],
  'laba-rugi': ['biaya', 'ekspor'],
};

interface NavbarProps {
  onSelectTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSelectTab }) => {
  const { user } = useAuth();
  const { mode, toggle } = useTema();

  const isOwner = user?.role === 'owner';

  return (
    <header className="kepala bg-[var(--utama)] text-white">
      <div className="kepala-baris">
        {/* Brand */}
        <button
          type="button"
          className="brand-nav"
          onClick={() => onSelectTab(isOwner ? 'dashboard' : 'kasir')}
        >
          <span className="brand-logo" aria-hidden="true">
            <img src="/LogoSKB.png" alt="" />
          </span>
          <div className="brand-teks">
            <b>
              Ayam Bebek <i>S.K.B</i>
            </b>
            <span className="kantor">
              {isOwner ? 'Laporan Pemilik' : 'Kasir'}
            </span>
          </div>
        </button>

        <OfflineBadge />

        {/* Actions - only theme toggle */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Toggle mode terang/gelap */}
          <button
            type="button"
            className="ikon-tombol"
            onClick={toggle}
            aria-pressed={mode === 'gelap'}
            aria-label={mode === 'gelap' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            title={mode === 'gelap' ? 'Mode terang' : 'Mode gelap'}
          >
            {mode === 'gelap' ? <Sun /> : <Moon />}
          </button>
        </div>
      </div>
    </header>
  );
};
