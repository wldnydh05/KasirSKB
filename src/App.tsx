/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { grupTab, type NavTab } from './components/common/Navbar';
import { LoginPage } from './components/auth/LoginPage';
import { ProfileModal } from './components/auth/ProfileModal';
import { initializeSyncEngine } from './db/syncEngine';

// Views
import { KasirView } from './components/kasir/KasirView';
import { PesananManagerView } from './components/pesanan/PesananManagerView';
import { DashboardOwnerView } from './components/dashboard/DashboardOwnerView';
import { MenuTerlarisView } from './components/dashboard/MenuTerlarisView';
import { PengaturanBiayaView } from './components/owner/PengaturanBiayaView';
import { EksporDataView } from './components/owner/EksporDataView';
import { KelolaMenuView } from './components/menu/KelolaMenuView';

import { BottomNav } from './components/common/BottomNav';
import { Sidebar } from './components/common/Sidebar';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const labelTab: Record<NavTab, string> = {
  dashboard: 'Dashboard',
  terlaris: 'Menu Terlaris',
  biaya: 'Biaya',
  ekspor: 'Ekspor',
  kasir: 'Kasir',
  riwayat: 'Riwayat',
  menu: 'Produk',
};

function MainLayout() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [syncReady, setSyncReady] = useState(false);

  // Initialize sync engine once on mount (non-blocking)
  useEffect(() => {
    initializeSyncEngine()
      .then(() => setSyncReady(true))
      .catch((err) => {
        console.warn('[App] Sync engine not available:', err);
        setSyncReady(true);
      });
  }, []);

  const isOwner = user?.role === 'owner';
  const [currentTab, setCurrentTab] = useState<NavTab>(() =>
    user?.role === 'owner' ? 'dashboard' : 'kasir'
  );
  // Modal "Pengaturan Akun & Profil" — dibuka dari nav bawah (mobile) & header (desktop)
  const [profilOpen, setProfilOpen] = useState(false);

  // Set appropriate starting tab based on role
  useEffect(() => {
    if (user) {
      if (user.role === 'owner') {
        setCurrentTab((prev) => (prev === 'kasir' ? 'dashboard' : prev));
      } else {
        // 'menu' (Produk) boleh untuk kasir — hanya untuk ubah status Tersedia/Habis
        const ownerOnlyTabs: NavTab[] = ['dashboard', 'terlaris', 'biaya', 'ekspor'];
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

    // 'menu' (Produk) boleh diakses kasir: hanya untuk mengubah status Tersedia/Habis
    const ownerOnlyTabs: NavTab[] = ['dashboard', 'terlaris', 'biaya', 'ekspor'];
    if (!isOwner && ownerOnlyTabs.includes(tab)) {
      showToast('Akses ditolak: Menu ini hanya dapat diakses oleh Pemilik Usaha (Owner).', 'error');
      setCurrentTab('kasir');
      return;
    }
    setCurrentTab(tab);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--latar)]">
        <img
          src="/LogoSKB.png"
          alt="Ayam Bebek S.K.B"
          className="h-16 object-contain mb-4"
        />
        <div className="w-8 h-8 border-3 border-[var(--utama-teks)] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium text-[var(--redup)]">Memuat data S.K.B...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Sub-halaman dalam kelompok nav (Owner: Laporan & Atur) → pilih lewat .segmen
  const grupAktif = isOwner ? Object.values(grupTab).find((g) => g.includes(currentTab)) : undefined;

  return (
    <div className="app-shell min-h-screen bg-[var(--latar)] flex flex-col pb-24 lg:pb-8">
      {/* Side bar kiri — hanya ≥761px (CSS .sisi); ≤760px memakai BottomNav */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenProfil={() => setProfilOpen(true)}
      />

      {grupAktif && (
        <div className="segmen-wrap w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4">
          <div className="segmen">
            {grupAktif.map((id) => (
              <button
                key={id}
                type="button"
                className={currentTab === id ? 'aktif' : ''}
                onClick={() => handleSelectTab(id)}
              >
                {labelTab[id]}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-4">
        {currentTab === 'kasir' && !isOwner && <KasirView />}
        {currentTab === 'riwayat' && (
          <PesananManagerView onNavigateToKasir={() => handleSelectTab(isOwner ? 'dashboard' : 'kasir')} />
        )}
        {currentTab === 'dashboard' && isOwner && <DashboardOwnerView onNavigate={handleSelectTab} />}
        {currentTab === 'terlaris' && isOwner && <MenuTerlarisView />}
        {currentTab === 'biaya' && isOwner && <PengaturanBiayaView />}
        {currentTab === 'ekspor' && isOwner && <EksporDataView />}
        {currentTab === 'menu' && <KelolaMenuView />}
      </main>

      {/* Android-style Bottom Navigation: role-based + entry Profil */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenProfil={() => setProfilOpen(true)}
      />

      <ProfileModal isOpen={profilOpen} onClose={() => setProfilOpen(false)} />
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
            <ErrorBoundary>
              <MainLayout />
            </ErrorBoundary>
          </CartProvider>
        </CabangProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

