/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  TrendingUp,
  DollarSign,
  UtensilsCrossed,
  Tag,
  FileSpreadsheet,
  Menu as MenuIcon,
  X,
  User,
  LogOut,
  ChevronDown,
  Store,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCabang } from '../../context/CabangContext';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineBadge } from './OfflineBadge';
import { ProfileModal } from '../auth/ProfileModal';

export type NavTab =
  | 'kasir'
  | 'riwayat'
  | 'dashboard'
  | 'terlaris'
  | 'biaya'
  | 'menu'
  | 'promo'
  | 'ekspor';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout } = useAuth();
  const { selectedCabangFilter, setSelectedCabangFilter, cabangList, activeCashierCabang } = useCabang();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const isOwner = user?.role === 'owner';

  // Define tabs based on role
  const tabs: { id: NavTab; label: string; icon: React.ReactNode; ownerOnly?: boolean }[] = [
    ...(isOwner
      ? [
          {
            id: 'dashboard' as NavTab,
            label: 'Dashboard',
            icon: <LayoutDashboard className="w-4 h-4" />,
            ownerOnly: true,
          },
        ]
      : []),
    ...(!isOwner
      ? [
          {
            id: 'kasir' as NavTab,
            label: 'Kasir',
            icon: <ShoppingCart className="w-4 h-4" />,
          },
        ]
      : []),
    {
      id: 'riwayat',
      label: 'Pesanan & Riwayat',
      icon: <History className="w-4 h-4" />,
    },
    ...(isOwner
      ? [
          {
            id: 'terlaris' as NavTab,
            label: 'Terlaris',
            icon: <TrendingUp className="w-4 h-4" />,
            ownerOnly: true,
          },
          {
            id: 'biaya' as NavTab,
            label: 'Biaya',
            icon: <DollarSign className="w-4 h-4" />,
            ownerOnly: true,
          },
        ]
      : []),
    {
      id: 'menu',
      label: isOwner ? 'Daftar Menu' : 'Menu',
      icon: <UtensilsCrossed className="w-4 h-4" />,
    },
    ...(isOwner
      ? [
          {
            id: 'promo' as NavTab,
            label: 'Promo',
            icon: <Tag className="w-4 h-4" />,
            ownerOnly: true,
          },
          {
            id: 'ekspor' as NavTab,
            label: 'Ekspor CSV',
            icon: <FileSpreadsheet className="w-4 h-4" />,
            ownerOnly: true,
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Brand */}
            <div className="flex items-center gap-3">
              <div
                onClick={() => onSelectTab(isOwner ? 'dashboard' : 'kasir')}
                className="flex items-center gap-2.5 cursor-pointer group"
              >
                <img
                  src="/logo-icon.png"
                  alt="BukuPOS"
                  className="w-9 h-9 rounded-lg object-contain bg-orange-50 border border-orange-200 p-0.5 shadow-2xs group-hover:scale-105 transition"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base font-bold text-gray-900 tracking-tight">
                      Buku<span className="text-[#FF6038]">POS</span>
                    </span>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                        isOwner
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isOwner ? 'Owner' : 'Kasir'}
                    </span>
                  </div>
                  {!isOwner && (
                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Store className="w-2.5 h-2.5 text-gray-400" />
                      <span>{user?.cabang || activeCashierCabang || 'Cabang 1'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Online/Offline indicator */}
              <OfflineBadge />

              {/* Owner Branch Filter in Topbar (Desktop) */}
              {isOwner && (
                <div className="hidden xl:flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 ml-2">
                  <div className="flex items-center gap-1 px-2 text-[11px] font-medium text-gray-600">
                    <Building2 className="w-3 h-3 text-gray-500" />
                    <span>Cabang:</span>
                  </div>
                  {['Semua', ...cabangList].map((c) => {
                    const isSelected = selectedCabangFilter === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCabangFilter(c)}
                        className={`px-2 py-0.5 rounded-md text-xs font-medium transition cursor-pointer ${
                          isSelected
                            ? 'bg-white text-orange-700 shadow-2xs font-semibold'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {c === 'Semua' ? 'Semua Cabang' : c}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Middle: Desktop Navigation links */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-1">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onSelectTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                      isActive
                        ? 'bg-orange-50 text-orange-700 border border-orange-200 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <PWAInstallButton />

              {/* User profile dropdown trigger */}
              <button
                onClick={() => setProfileModalOpen(true)}
                className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-gray-100 transition border border-gray-200"
              >
                {user?.foto_url ? (
                  <img
                    src={user.foto_url}
                    alt={user?.username}
                    className="w-7 h-7 rounded-md object-cover border border-gray-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs uppercase">
                    {(user?.nama_lengkap || user?.username || 'U')[0]}
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-medium text-gray-800 max-w-[100px] truncate">
                  {user?.nama_lengkap || user?.username}
                </span>
                <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-gray-400" />
              </button>

              {/* Mobile hamburger menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown navigation menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white p-3 space-y-2 shadow-lg">
            <div className="text-xs font-semibold text-gray-500 px-1">
              Menu Aplikasi
            </div>

            {/* Filter Cabang Khusus Owner di HP */}
            {isOwner && (
              <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-gray-500" />
                  <span>Filter Pantauan Cabang:</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {['Semua', ...cabangList].map((c) => {
                    const isSelected = selectedCabangFilter === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCabangFilter(c)}
                        className={`py-1.5 px-1 rounded-md text-xs font-medium transition text-center ${
                          isSelected
                            ? 'bg-orange-600 text-white font-semibold'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {c === 'Semua' ? 'Semua' : c}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pilihan 1: Kelola Menu */}
            <button
              onClick={() => {
                onSelectTab('menu');
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition ${
                currentTab === 'menu'
                  ? 'bg-orange-50 text-orange-700 border border-orange-200 font-semibold'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              <div className="w-9 h-9 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-900">
                  {isOwner ? 'Daftar Menu' : 'Kelola Menu'}
                </div>
                <div className="text-[11px] text-gray-500">
                  {isOwner
                    ? 'Lihat daftar harga & katalog menu'
                    : 'Tambah, edit harga & foto menu'}
                </div>
              </div>
            </button>

            {/* Pilihan 2: Pengaturan Akun */}
            <button
              onClick={() => {
                setProfileModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 transition"
            >
              <div className="w-9 h-9 rounded-md bg-gray-200 text-gray-700 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-gray-900">Pengaturan Akun</div>
                <div className="text-[11px] text-gray-500">
                  Profil, ganti password, & kelola kasir
                </div>
              </div>
            </button>
          </div>
        )}
      </header>

      {/* Profile modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
};

