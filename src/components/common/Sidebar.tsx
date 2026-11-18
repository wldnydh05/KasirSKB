/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TrendingUp, Package, History, Settings, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavBadge } from '../../hooks/useNavBadge';
import { grupTab, type NavTab } from './Navbar';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  /** Buka modal "Pengaturan Akun & Profil" */
  onOpenProfil: () => void;
}

type ItemSidebar = {
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
 * Side bar kiri khusus desktop — CSS .sisi: block ≥761px, sembunyi ≤760px
 * (di layar kecil navigasi pindah ke BottomNav).
 * Isinya identik dengan BottomNav:
 * Owner: Laporan · Produk · Riwayat · Laba/Rugi · Profil
 * Kasir: Kasir · Produk · Riwayat · Profil
 */
export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab, onOpenProfil }) => {
  const { user } = useAuth();
  const { totalItemsCount, unpaidCount } = useNavBadge();

  const isOwner = user?.role === 'owner';

  const navOwner: ItemSidebar[] = [
    { id: 'dashboard', label: 'Laporan', icon: <TrendingUp />, grup: 'laporan' },
    { id: 'menu', label: 'Produk', icon: <Package /> },
    { id: 'riwayat', label: 'Riwayat', icon: <History /> },
    { id: 'biaya', label: 'Laba/Rugi', icon: <Settings />, grup: 'laba-rugi' },
  ];

  const navKasir: ItemSidebar[] = [
    { id: 'kasir', label: 'Kasir', icon: <ShoppingCart />, hitung: totalItemsCount, warna: 'hijau' },
    { id: 'menu', label: 'Produk', icon: <Package /> },
    { id: 'riwayat', label: 'Riwayat', icon: <History />, hitung: unpaidCount, warna: 'merah' },
  ];

  const items: ItemSidebar[] = [
    ...(isOwner ? navOwner : navKasir),
    { label: 'Profil', icon: <User />, aksi: onOpenProfil },
  ];

  const aktif = (item: ItemSidebar) =>
    item.grup ? grupTab[item.grup].includes(currentTab) : !!item.id && currentTab === item.id;

  const klik = (item: ItemSidebar) => {
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
    warna === 'hijau' ? 'bg-[var(--utama)]' : 'bg-[var(--bahaya)]';

  return (
    <aside className="sisi" aria-label="Navigasi utama">
      <span className="sisi-judul">Menu Utama</span>
      {items.map((item) => (
        <button
          key={item.id ?? item.label}
          type="button"
          className={`sisi-tautan ${aktif(item) ? 'aktif' : ''}`}
          aria-current={aktif(item) ? 'page' : undefined}
          onClick={() => klik(item)}
        >
          <span className="relative">
            {item.icon}
            {(item.hitung ?? 0) > 0 && (
              <span
                className={`absolute -top-1.5 -right-2 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[10px] font-bold text-white ${warnaBadge(item.warna)}`}
              >
                {item.hitung}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </aside>
  );
};
