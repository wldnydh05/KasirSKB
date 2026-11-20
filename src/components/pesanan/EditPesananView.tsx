/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Search,
  Save,
  AlertCircle,
  Utensils,
  Check,
  ShoppingBag,
  User,
  Coffee,
  ImageOff,
} from 'lucide-react';
import { menuService, pesananAktifService } from '../../lib/supabaseService';
import type { PesananAktif, CartItem, Menu } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';
import { Spinner } from '../ui/Spinner';

interface EditPesananViewProps {
  order: PesananAktif;
  onBack: () => void;
  onSaved: (updatedOrder: PesananAktif) => void;
}

export const EditPesananView: React.FC<EditPesananViewProps> = ({
  order,
  onBack,
  onSaved,
}) => {
  const { showToast } = useToast();
  const { activeCashierCabang, cabangList } = useCabang();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Custom price dialog for harga_custom items
  const [customPriceMenu, setCustomPriceMenu] = useState<Menu | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState('');

  // Local cart items from the order
  const [items, setItems] = useState<CartItem[]>(order.items || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Determine the branch for this order
  const orderCabang = order.cabang || activeCashierCabang || cabangList[0] || '';

  // Load catalog from Supabase
  const loadCatalog = async () => {
    setIsLoading(true);
    try {
      const allMenus = await menuService.getByCabang(orderCabang);
      // Filter only active and not soft-deleted
      const activeMenus = allMenus.filter(m => m.aktif && !m.deleted_at);
      setMenus(activeMenus);
    } catch (err) {
      console.error('Failed to load catalog:', err);
      showToast('Gagal memuat daftar menu.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [orderCabang]);

  // Helper: add item to local items
  const addItem = (menu: Menu, customHarga?: number) => {
    const isManualPrice = typeof customHarga === 'number' && customHarga > 0;
    const harga = isManualPrice ? customHarga : menu.harga;

    setItems((prev) => {
      if (!isManualPrice) {
        const existingIndex = prev.findIndex(
          (item) => !item.is_manual && item.menu_id === menu.id
        );
        if (existingIndex > -1) {
          const next = [...prev];
          const current = next[existingIndex];
          const newQty = current.jumlah + 1;
          next[existingIndex] = {
            ...current,
            jumlah: newQty,
            subtotal: current.harga * newQty,
          };
          return next;
        }
      }
      return [
        ...prev,
        {
          menu_id: menu.id,
          nama: menu.nama,
          harga,
          biaya_bahan_baku: menu.biaya_bahan_baku || 0,
          jumlah: 1,
          subtotal: harga,
          gambar_url: menu.gambar_url,
          is_manual: isManualPrice,
        },
      ];
    });
  };

  // Helper: update quantity
  const updateQuantity = (index: number, delta: number) => {
    setItems((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const target = prev[index];
      const newQty = target.jumlah + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      const next = [...prev];
      next[index] = {
        ...target,
        jumlah: newQty,
        subtotal: target.harga * newQty,
      };
      return next;
    });
  };

  // Helper: remove item
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle menu tap
  const handleMenuTap = (menu: Menu) => {
    if (!menu.aktif) return;

    if (menu.harga_custom) {
      setCustomPriceInput('');
      setCustomPriceMenu(menu);
      return;
    }

    addItem(menu);
  };

  // Confirm custom price
  const handleConfirmCustomPrice = () => {
    if (!customPriceMenu) return;
    const price = parseInt(customPriceInput, 10);
    if (!price || price <= 0) {
      showToast('Harga harus angka lebih dari 0.', 'error');
      return;
    }
    addItem(customPriceMenu, price);
    setCustomPriceMenu(null);
    showToast(
      `${customPriceMenu.nama} Rp${price.toLocaleString('id-ID')} ditambahkan.`,
      'success'
    );
  };

  // Save updated order to Supabase
  const handleSave = async () => {
    if (items.length === 0) {
      showToast('Pesanan tidak boleh kosong.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedOrder = await pesananAktifService.update(order.id!, {
        items,
        total: items.reduce((sum, it) => sum + it.subtotal, 0),
        updated_at: nowIso,
      });

      showToast('Pesanan berhasil diperbarui.', 'success');
      onSaved(updatedOrder);
    } catch (err) {
      console.error('Failed to save order:', err);
      showToast('Gagal menyimpan pesanan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle back with confirmation if unsaved changes
  const handleBack = () => {
    const hasChanges =
      items.length !== (order.items?.length || 0) ||
      items.some(
        (it, i) =>
          it.jumlah !== order.items?.[i]?.jumlah ||
          it.harga !== order.items?.[i]?.harga ||
          it.nama !== order.items?.[i]?.nama
      );

    if (hasChanges) {
      setIsCancelDialogOpen(true);
    } else {
      onBack();
    }
  };

  // Filter menus for catalog
  const filteredMenus = menus
    .filter((menu) => {
      const namaMenu = String(menu.nama ?? '');
      const kategoriMenu = String(menu.kategori ?? '');
      const matchesCategory =
        selectedCategory === 'Semua' ||
        kategoriMenu.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch =
        namaMenu.toLowerCase().includes(searchQuery.toLowerCase()) ||
        kategoriMenu.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      // Sort: categories first, then name
      if (a.kategori !== b.kategori) return a.kategori.localeCompare(b.kategori);
      return a.nama.localeCompare(b.nama);
    });

  const totalItems = items.reduce((sum, it) => sum + it.jumlah, 0);
  const totalAmount = items.reduce((sum, it) => sum + it.subtotal, 0);

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="w-10 h-10 rounded-2xl bg-[var(--latar)] hover:bg-[var(--garis)] text-[var(--teks)] flex items-center justify-center transition active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-[var(--teks)]">
              Ubah Pesanan #{order.nomor_pesanan}
            </h1>
            <p className="text-xs text-[var(--redup)]">
              {order.nama_pelanggan} · {order.tipe_pesanan || 'Bungkus'}{' '}
              {order.tipe_pesanan === 'Makan Di Tempat' && order.nomor_meja
                ? `· Meja ${order.nomor_meja}`
                : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isSaving || items.length === 0}
          onClick={handleSave}
          className={`min-h-[44px] px-4 py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
            isSaving || items.length === 0
              ? 'bg-[var(--garis)] text-[var(--redup)] cursor-not-allowed'
              : 'bg-[var(--utama)] hover:bg-[var(--utama-tua)] text-white shadow-sm shadow-[var(--utama)]/20'
          }`}
        >
          {isSaving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
        </button>
      </div>

      {/* Current Order Summary - compact receipt style */}
      <div className="bg-[var(--kartu)] rounded-3xl p-3 sm:p-4 border border-[var(--garis)]/90 shadow-2xs mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[var(--redup)] uppercase tracking-wider">
            Rincian Pesanan Saat Ini
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--teks)] bg-[var(--latar)] px-2 py-0.5 rounded">
              {totalItems} Item
            </span>
            <span className="text-sm font-black text-[var(--utama-teks)]">
              {formatRupiah(totalAmount)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-xs text-[var(--redup)] text-center py-4">
              Belum ada item. Tambah dari katalog di bawah.
            </p>
          ) : (
            items.map((it, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center text-xs py-1.5 px-2 bg-[var(--latar)]/50 rounded-xl border border-[var(--garis)]/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="font-black text-[var(--utama-teks)] bg-[var(--utama-muda)]/80 px-1.5 py-0.5 rounded shrink-0">
                    {it.jumlah}x
                  </span>
                  <span className="text-[var(--teks)] font-medium truncate">
                    {it.nama}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-[var(--teks)]">
                    {formatRupiah(it.subtotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition active:scale-90"
                    title="Hapus item ini"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Catalog Search & Filter */}
      <div className="mb-3">
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--redup)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu..."
            className="w-full pl-10 pr-3 py-2 rounded-2xl bg-[var(--kartu)] border border-[var(--garis)]/90 text-sm text-[var(--teks)] placeholder:text-[var(--redup)] focus:outline-none focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {['Semua', 'Makanan', 'Minuman', 'Lainnya'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-[var(--utama)] text-white shadow-sm shadow-[var(--utama)]/20'
                  : 'bg-[var(--kartu)] border border-[var(--garis)] text-[var(--redup)] hover:bg-[var(--latar)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-[var(--redup)]">
          Memuat katalog menu...
        </div>
      ) : filteredMenus.length === 0 ? (
        <div className="text-center py-12 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-6">
          <p className="text-sm font-semibold text-[var(--teks)]">Tidak ada menu yang cocok</p>
          <p className="text-xs text-[var(--redup)] mt-1">
            Coba ubah kata kunci pencarian atau pilih kategori lain.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {filteredMenus.map((menu) => {
            // Count in current order
            const inOrder = items.find(
              (it) => !it.is_manual && it.menu_id === menu.id
            );
            const qtyInOrder = inOrder ? inOrder.jumlah : 0;

            return (
              <div
                key={menu.id}
                onClick={() => handleMenuTap(menu)}
                className={`relative group bg-[var(--kartu)] rounded-2xl p-2.5 border transition duration-150 cursor-pointer select-none flex flex-col justify-between ${
                  !menu.aktif
                    ? 'opacity-50 grayscale border-[var(--garis)] pointer-events-none'
                    : 'border-[var(--garis)]/90 hover:border-[var(--garis-kuat)] hover:shadow-md'
                }`}
              >
                {/* Image 1:1 ratio */}
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-[var(--latar)] mb-2">
                  {menu.gambar_url ? (
                    <img
                      src={menu.gambar_url}
                      alt={menu.nama}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--latar)] text-[var(--redup)] p-2 text-center select-none group-hover:bg-[var(--garis)]/60 transition">
                      <ImageOff className="w-5 h-5 text-[var(--redup)] mb-1" />
                      <span className="text-[10px] font-bold text-[var(--redup)] leading-tight">
                        Gambar tidak ada
                      </span>
                    </div>
                  )}

                  {/* Category Pill Tag */}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--kartu)]/90 backdrop-blur-xs text-[var(--teks)] shadow-2xs">
                    {menu.kategori}
                  </span>

                  {/* Quantity In Order Badge */}
                  {qtyInOrder > 0 && (
                    <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--utama)] text-white text-xs font-extrabold shadow-md border-2 border-white animate-in zoom-in-75">
                      {qtyInOrder}
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
                  <h3 className="font-bold text-xs text-[var(--teks)] line-clamp-2 leading-tight">
                    {menu.nama}
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[var(--utama-teks)]">
                      {menu.harga_custom
                        ? menu.harga_range
                          ? `Rp${menu.harga_range}`
                          : 'Ketik harga'
                        : formatRupiah(menu.harga)}
                    </span>

                    <button
                      type="button"
                      className="w-6 h-6 rounded-lg bg-[var(--utama-muda)] text-[var(--utama-teks)] group-hover:bg-[var(--utama)] group-hover:text-white flex items-center justify-center transition active:scale-90"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom Price Dialog */}
      {customPriceMenu && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-5 border border-[var(--garis)] animate-in zoom-in-95">
            <h3 className="text-base font-black text-[var(--teks)]">{customPriceMenu.nama}</h3>
            <p className="text-xs text-[var(--redup)] mt-0.5 mb-4 leading-relaxed">
              Masukkan harga menu ini
              {customPriceMenu.harga_range
                ? ` — di menu asli Rp${customPriceMenu.harga_range}`
                : ''}.
            </p>

            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[var(--redup)] pointer-events-none">
                Rp
              </span>
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={customPriceInput}
                onChange={(e) => setCustomPriceInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Contoh: 16000"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmCustomPrice();
                }}
                className="w-full pl-9 pr-3 py-2.5 text-lg font-black text-[var(--teks)] bg-[var(--latar)] border border-[var(--garis-kuat)] rounded-xl outline-none focus:border-[var(--utama-teks)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCustomPriceMenu(null)}
                className="py-2.5 rounded-xl border border-[var(--garis)] bg-[var(--latar)] hover:bg-[var(--garis)] text-xs font-bold text-[var(--teks)] transition active:scale-95"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCustomPrice}
                className="py-2.5 rounded-xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] text-xs font-black text-white shadow-sm transition active:scale-95"
              >
                Tambah ke Pesanan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL CHANGES CONFIRMATION */}
      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-6 border border-[var(--garis)] text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-[var(--teks)] mb-1.5 leading-snug">
              Yakin ingin batalkan ubah pesanan?
            </h3>
            <p className="text-xs text-[var(--redup)] mb-6 leading-relaxed">
              Perubahan item dan rincian pesanan yang belum disimpan akan hilang dan pesanan tetap seperti semula.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
                className="py-3 px-3 rounded-2xl border border-[var(--garis)] bg-[var(--latar)] hover:bg-[var(--garis)] text-xs font-bold text-[var(--teks)] transition active:scale-95"
              >
                Lanjut Mengubah
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCancelDialogOpen(false);
                  onBack();
                }}
                className="py-3 px-3 rounded-2xl bg-[var(--bahaya)] hover:bg-[var(--bahaya-teks)] text-xs font-black text-white shadow-sm shadow-[var(--bahaya-teks)]/20 transition active:scale-95"
              >
                Ya, Batalkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};