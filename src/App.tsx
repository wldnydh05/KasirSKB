/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Navbar, type NavTab } from './components/common/Navbar';
import { LoginPage } from './components/auth/LoginPage';

// Views
import { KasirView } from './components/kasir/KasirView';
import { PesananManagerView } from './components/pesanan/PesananManagerView';
import { DashboardOwnerView } from './components/dashboard/DashboardOwnerView';
import { MenuTerlarisView } from './components/dashboard/MenuTerlarisView';
import { PengaturanBiayaView } from './components/owner/PengaturanBiayaView';
import { KelolaPromoView } from './components/owner/KelolaPromoView';
import { EksporDataView } from './components/owner/EksporDataView';
import { KelolaMenuView } from './components/menu/KelolaMenuView';

import { BottomNav } from './components/common/BottomNav';

function MainLayout() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();

  const isOwner = user?.role === 'owner';
  const [currentTab, setCurrentTab] = useState<NavTab>(() =>
    user?.role === 'owner' ? 'dashboard' : 'kasir'
  );

  // Set appropriate starting tab based on role
  useEffect(() => {
    if (user) {
      if (user.role === 'owner') {
        setCurrentTab((prev) => (prev === 'kasir' ? 'dashboard' : prev));
      } else {
        const ownerOnlyTabs: NavTab[] = ['dashboard', 'terlaris', 'biaya', 'promo', 'ekspor'];
        setCurrentTab((prev) => (ownerOnlyTabs.includes(prev) ? 'kasir' : prev));
      }
    }
  }, [user?.role]);

  // Route guard (FR-A03, AC-17)
  const handleSelectTab = (tab: NavTab) => {
    // Owner is strictly prevented from accessing Kasir POS
    if (isOwner && tab === 'kasir') {
      showToast('Akses dibatasi: Pemilik Usaha (Owner) tidak memiliki akses ke Menu Kasir.', 'error');
      setCurrentTab('dashboard');
      return;
    }

    const ownerOnlyTabs: NavTab[] = ['dashboard', 'terlaris', 'biaya', 'promo', 'ekspor'];
    if (!isOwner && ownerOnlyTabs.includes(tab)) {
      showToast('Akses ditolak: Menu ini hanya dapat diakses oleh Pemilik Usaha (Owner).', 'error');
      setCurrentTab('kasir');
      return;
    }
    setCurrentTab(tab);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <img
          src="/logo.png"
          alt="BukuPOS"
          className="h-16 object-contain mb-4"
        />
        <div className="w-8 h-8 border-3 border-orange-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-gray-600">Memuat data BukuPOS...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col font-sans pb-16">
      <Navbar currentTab={currentTab} onSelectTab={handleSelectTab} />

      <main className="flex-1 w-full">
        {currentTab === 'kasir' && !isOwner && <KasirView />}
        {currentTab === 'riwayat' && (
          <PesananManagerView onNavigateToKasir={() => handleSelectTab(isOwner ? 'dashboard' : 'kasir')} />
        )}
        {currentTab === 'dashboard' && isOwner && <DashboardOwnerView onNavigate={handleSelectTab} />}
        {currentTab === 'terlaris' && isOwner && <MenuTerlarisView />}
        {currentTab === 'biaya' && isOwner && <PengaturanBiayaView />}
        {currentTab === 'promo' && isOwner && <KelolaPromoView />}
        {currentTab === 'ekspor' && isOwner && <EksporDataView />}
        {currentTab === 'menu' && <KelolaMenuView />}
      </main>

      {/* Android-style Bottom Navigation: Kiri: Pesanan, Kanan: Kasir */}
      <BottomNav currentTab={currentTab} onSelectTab={handleSelectTab} />
    </div>
  );
}

import { CabangProvider } from './context/CabangContext';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CabangProvider>
          <CartProvider>
            <MainLayout />
          </CartProvider>
        </CabangProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

