/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Receipt, Store, LayoutDashboard, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { db } from '../../db';
import type { NavTab } from './Navbar';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const { totalItemsCount } = useCart();
  const [unpaidCount, setUnpaidCount] = useState<number>(0);

  const isOwner = user?.role === 'owner';

  // Load unpaid active orders count for the "Pesanan" badge
  useEffect(() => {
    async function loadCount() {
      try {
        const count = await db.pesanan_aktif.count();
        setUnpaidCount(count);
      } catch (e) {
        console.error('Failed to count unpaid active orders', e);
      }
    }

    loadCount();
    const interval = setInterval(loadCount, 3000);
    return () => clearInterval(interval);
  }, [currentTab]);

  const isPesananActive = currentTab === 'riwayat';
  const isKasirActive = currentTab === 'kasir';
  const isDashboardActive = currentTab === 'dashboard';
  const isMenuActive = currentTab === 'menu';

  return (
    <nav
      aria-label="Akses Cepat Ponsel"
      className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-sm pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 select-none"
    >
      {isOwner ? (
        /* OWNER BOTTOM NAV: Dashboard, Pesanan, Daftar Menu */
        <div className="max-w-md mx-auto px-3 grid grid-cols-3 gap-2 h-13">
          {/* 1: Dashboard */}
          <button
            onClick={() => onSelectTab('dashboard')}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition ${
              isDashboardActive
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[11px] font-medium mt-0.5">Dashboard</span>
          </button>

          {/* 2: Pesanan & Riwayat */}
          <button
            onClick={() => onSelectTab('riwayat')}
            type="button"
            className={`relative flex flex-col items-center justify-center py-1 px-1 rounded-lg transition ${
              isPesananActive
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <div className="relative">
              <Receipt className="w-4 h-4" />
              {unpaidCount > 0 && (
                <span className="absolute -top-1.5 -right-3 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-bold bg-red-600 text-white">
                  {unpaidCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium mt-0.5">Pesanan</span>
          </button>

          {/* 3: Daftar Menu */}
          <button
            onClick={() => onSelectTab('menu')}
            type="button"
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-lg transition ${
              isMenuActive
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span className="text-[11px] font-medium mt-0.5">Daftar Menu</span>
          </button>
        </div>
      ) : (
        /* STAFF BOTTOM NAV: Pesanan & Kasir POS */
        <div className="max-w-md mx-auto px-3 grid grid-cols-2 gap-2.5 h-13">
          {/* Kiri: Pesanan */}
          <button
            onClick={() => onSelectTab('riwayat')}
            type="button"
            className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 transition ${
              isPesananActive
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <div className="relative">
              <Receipt className="w-4 h-4" />
              {unpaidCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-bold bg-red-600 text-white">
                  {unpaidCount}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold">Pesanan & Antrean</span>
          </button>

          {/* Kanan: Kasir */}
          <button
            onClick={() => onSelectTab('kasir')}
            type="button"
            className={`flex items-center justify-center gap-2 rounded-lg py-2 px-3 transition ${
              isKasirActive
                ? 'bg-orange-600 text-white font-semibold'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
            }`}
          >
            <div className="relative">
              <Store className="w-4 h-4" />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full text-[9px] font-bold bg-emerald-600 text-white">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold">Kasir POS</span>
          </button>
        </div>
      )}
    </nav>
  );
};

