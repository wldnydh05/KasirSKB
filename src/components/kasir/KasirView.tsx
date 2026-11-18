/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  PlusCircle,
  Tag,
  CheckCircle,
  ImageOff,
} from 'lucide-react';
import { db } from '../../db';
import type { Menu, Kategori, Transaksi, DetailTransaksi } from '../../types';
import { useCart } from '../../context/CartContext';
import { formatRupiah } from '../../utils/formatters';
import { CartBottomSheet } from './CartBottomSheet';
import { ReceiptModal } from './ReceiptModal';

export const KasirView: React.FC = () => {
  const { addItem, items: cartItems } = useCart();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Kategori[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Completed transaction for receipt modal
  const [lastTx, setLastTx] = useState<Transaksi | null>(null);
  const [lastTxItems, setLastTxItems] = useState<DetailTransaksi[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Recent tapped item id for micro-animation
  const [recentlyTappedId, setRecentlyTappedId] = useState<number | null>(null);

  // Load menu & categories from Dexie IndexedDB
  const loadData = async () => {
    const allCategories = await db.kategori.toArray();
    setCategories(allCategories);

    const allMenus = await db.menus.toArray();
    setMenus(allMenus);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMenuTap = (menu: Menu) => {
    if (!menu.aktif) return;
    addItem(menu);

    if (menu.id) {
      setRecentlyTappedId(menu.id);
      setTimeout(() => setRecentlyTappedId(null), 300);
    }
  };

  const handleTransactionSuccess = (tx: Transaksi, detailItems: DetailTransaksi[]) => {
    setLastTx(tx);
    setLastTxItems(detailItems);
    setIsReceiptOpen(true);
  };

  // Filter menus
  const filteredMenus = menus.filter((menu) => {
    const matchesCategory =
      selectedCategory === 'Semua' || menu.kategori.toLowerCase() === selectedCategory.toLowerCase();
    const matchesSearch =
      menu.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      menu.kategori.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--redup)]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu makanan, minuman..."
            className="w-full pl-10 pr-3.5 py-2.5 rounded-2xl bg-[var(--kartu)] border border-[var(--garis)]/90 text-sm text-[var(--teks)] placeholder:text-[var(--redup)] focus:outline-none focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-[var(--redup)] hover:text-[var(--redup)]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Categories Horizontal Scroll */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-2">
        {['Semua', 'Makanan', 'Minuman', 'Lainnya'].map((catName) => {
          const isSelected = selectedCategory.toLowerCase() === catName.toLowerCase();
          return (
            <button
              key={catName}
              onClick={() => setSelectedCategory(catName)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition whitespace-nowrap active:scale-95 ${
                isSelected
                  ? 'bg-[var(--utama)] text-white shadow-sm shadow-[var(--utama)]/20'
                  : 'bg-[var(--kartu)] border border-[var(--garis)] text-[var(--redup)] hover:bg-[var(--latar)]'
              }`}
            >
              {catName}
            </button>
          );
        })}
      </div>

      {/* Menu Grid - 2 columns on mobile, 3-4 on larger screens (FR-K01, PRD 10.2) */}
      {filteredMenus.length === 0 ? (
        <div className="text-center py-12 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-6">
          <p className="text-sm font-semibold text-[var(--teks)]">Tidak ada menu yang cocok</p>
          <p className="text-xs text-[var(--redup)] mt-1">
            Coba ubah kata kunci pencarian atau pilih kategori lain.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredMenus.map((menu) => {
            const isTapped = recentlyTappedId === menu.id;
            // Count in cart
            const inCart = cartItems.find((it) => it.menu_id === menu.id);
            const qtyInCart = inCart ? inCart.jumlah : 0;

            return (
              <div
                key={menu.id}
                onClick={() => handleMenuTap(menu)}
                className={`relative group bg-[var(--kartu)] rounded-2xl sm:rounded-3xl p-2.5 sm:p-3 border transition duration-150 cursor-pointer select-none flex flex-col justify-between ${
                  !menu.aktif
                    ? 'opacity-50 grayscale border-[var(--garis)] pointer-events-none'
                    : isTapped
                    ? 'scale-95 border-[var(--utama-teks)] shadow-md ring-2 ring-[var(--utama-teks)]/30'
                    : 'border-[var(--garis)]/90 hover:border-[var(--garis-kuat)] hover:shadow-md'
                }`}
              >
                {/* Image 1:1 ratio */}
                <div className="relative w-full aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-[var(--latar)] mb-2">
                  {menu.gambar_url ? (
                    <img
                      src={menu.gambar_url}
                      alt={menu.nama}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--latar)] text-[var(--redup)] p-2 text-center select-none group-hover:bg-[var(--garis)]/60 transition">
                      <ImageOff className="w-6 h-6 sm:w-7 sm:h-7 text-[var(--redup)] mb-1" />
                      <span className="text-[10px] sm:text-[11px] font-bold text-[var(--redup)] leading-tight">
                        Gambar tidak ada
                      </span>
                    </div>
                  )}

                  {/* Category Pill Tag */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--kartu)]/90 backdrop-blur-xs text-[var(--teks)] shadow-2xs">
                    {menu.kategori}
                  </span>

                  {/* Quantity In Cart Badge */}
                  {qtyInCart > 0 && (
                    <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--utama)] text-white text-xs font-extrabold shadow-md border-2 border-white animate-in zoom-in-75">
                      {qtyInCart}
                    </span>
                  )}

                  {!menu.aktif && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="text-white text-xs font-bold uppercase tracking-wider bg-[var(--bahaya)] px-2.5 py-1 rounded-full">
                        Habis
                      </span>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-[var(--teks)] line-clamp-2 leading-tight">
                    {menu.nama}
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-extrabold text-[var(--utama-teks)]">
                      {formatRupiah(menu.harga)}
                    </span>

                    <button
                      type="button"
                      className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl bg-[var(--utama-muda)] text-[var(--utama-teks)] group-hover:bg-[var(--utama)] group-hover:text-white flex items-center justify-center transition active:scale-90"
                    >
                      <PlusCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart Bottom Sheet (Peek 80px & Full Expand) */}
      <CartBottomSheet onTransactionSuccess={handleTransactionSuccess} />

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaksi={lastTx}
        items={lastTxItems}
        onNewTransaction={() => setIsReceiptOpen(false)}
      />
    </div>
  );
};

