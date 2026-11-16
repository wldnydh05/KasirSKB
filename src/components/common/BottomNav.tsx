/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShoppingCart, History, Package, TrendingUp, User, BarChart2, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavBadge } from '../../hooks/useNavBadge';
import { grupTab, type NavTab } from './Navbar';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  /** Buka modal "Pengaturan Akun & Profil" (pengganti tombol avatar di header) */
  onOpenProfil: () => void;
}

type NavItem = {
  id?: NavTab;
  label: string;
  icon: React.ReactNode;
  grup?: keyof typeof grupTab;
  /** badge angka (mis. antrean belum bayar / item keranjang) */
  hitung?: number;
  warna?: 'merah' | 'hijau';
  /** aksi khusus yang bukan pindah tab (mis. buka modal profil) */
  aksi?: () => void;
};

/**
 * Nav bawah selalu dirender (CSS .bawah: flex ≤760px, sembunyi ≥761px —
 * di layar lebar navigasi pindah ke Sidebar kiri / .sisi).
 * Owner: Produk · Laba/Rugi · Laporan · Riwayat · Profil — Kasir: Kasir · Riwayat · Profil.
 * "Profil" membuka modal Pengaturan Akun & Profil (aksi, bukan pindah tab).
 * Laporan (TrendingUp) ditempatkan di tengah (posisi 3 dari 5).
 * Laba/Rugi menggunakan ikon BarChart2 (grafik keuangan) lebih sesuai maknanya.
 */
export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab, onOpenProfil }) => {
  const { user } = useAuth();
  const { totalItemsCount, unpaidCount } = useNavBadge();

  const isOwner = user?.role === 'owner';

  const navOwner: NavItem[] = [
    { id: 'menu', label: 'Produk', icon: <Package /> },
    { id: 'biaya', label: 'Laba/Rugi', icon: <BarChart2 />, grup: 'laba-rugi' },
    { id: 'dashboard', label: 'Laporan', icon: <TrendingUp />, grup: 'laporan' },
    { id: 'riwayat', label: 'Riwayat', icon: <History />, hitung: unpaidCount, warna: 'merah' },
  ];

  const navKasir: NavItem[] = [
    { id: 'kasir', label: 'Kasir', icon: <ShoppingCart />, hitung: totalItemsCount, warna: 'hijau' },
    { id: 'riwayat', label: 'Riwayat', icon: <History />, hitung: unpaidCount, warna: 'merah' },
  ];

  // "Profil" selalu ada: pembuka modal Pengaturan Akun & Profil
  const items: NavItem[] = [
    ...(isOwner ? navOwner : navKasir),
    { label: 'Profil', icon: <User />, aksi: onOpenProfil },
  ];

  const aktif = (item: NavItem) =>
    item.grup ? grupTab[item.grup].includes(currentTab) : !!item.id && currentTab === item.id;

  const klik = (item: NavItem) => {
    if (item.aksi) {
      item.aksi();
      return;
    }
    if (item.grup) {
      onSelectTab(grupTab[item.grup][0]);
      return;
    }
    if (item.id) onSelectTab(item.id);
  };

  const warnaBadge = (warna?: 'merah' | 'hijau') =>
    warna === 'hijau' ? 'bg-emerald-600' : 'bg-red-600';

  return (
    <nav className="bawah" aria-label="Navigasi utama">
      {items.map((item) => (
        <button
          key={item.id ?? item.label}
          type="button"
          className={`nav ${aktif(item) ? 'aktif' : ''}`}
          aria-current={aktif(item) ? 'page' : undefined}
          onClick={() => klik(item)}
        >
          <span className="relative">
            {item.icon}
            {(item.hitung ?? 0) > 0 && (
              <span
                className={`absolute -top-1 -right-2.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-bold text-white ${warnaBadge(item.warna)}`}
              >
                {item.hitung}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
