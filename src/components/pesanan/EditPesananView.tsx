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
import { db } from '../../db';
import type { PesananAktif, CartItem, Menu } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

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

  // Order fields
  const [items, setItems] = useState<CartItem[]>(() =>
    (order.items || []).map((it) => ({ ...it }))
  );
  const [namaPelanggan, setNamaPelanggan] = useState(order.nama_pelanggan || '');
  const [tipePesanan, setTipePesanan] = useState<'Makan Di Tempat' | 'Bungkus'>(
    order.tipe_pesanan || (order.nomor_meja ? 'Makan Di Tempat' : 'Bungkus')
  );
  const [nomorMeja, setNomorMeja] = useState(order.nomor_meja || '');
  const [catatan, setCatatan] = useState(order.catatan || '');

  // Catalog state to add items
  const [menuList, setMenuList] = useState<Menu[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [categories, setCategories] = useState<string[]>(['Semua']);

  // Modals / loading
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load menu catalog
  useEffect(() => {
    async function loadCatalog() {
      try {
        const allMenus: Menu[] = await db.menus.toArray();
        const activeMenus = allMenus.filter((m) => Boolean(m.aktif));
        setMenuList(activeMenus);

        const cats: string[] = Array.from(
          new Set(activeMenus.map((m) => m.kategori).filter((k): k is string => Boolean(k)))
        );
        setCategories(['Semua', ...cats]);
      } catch (err) {
        console.error('Failed to load menu catalog', err);
      }
    }
    loadCatalog();
  }, []);

  // Update item quantity
  const handleUpdateQty = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const newQty = target.jumlah + delta;
      if (newQty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      next[index] = {
        ...target,
        jumlah: newQty,
        subtotal: target.harga * newQty,
      };
      return next;
    });
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add menu item to order
  const handleAddMenuItem = (menu: Menu) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => !it.is_manual && it.menu_id === menu.id);
      if (existingIdx > -1) {
        const next = [...prev];
        const target = next[existingIdx];
        const newQty = target.jumlah + 1;
        next[existingIdx] = {
          ...target,
          jumlah: newQty,
          subtotal: target.harga * newQty,
        };
        return next;
      } else {
        return [
          ...prev,
          {
            menu_id: menu.id,
            nama: menu.nama,
            harga: menu.harga,
            biaya_bahan_baku: menu.biaya_bahan_baku || 0,
            jumlah: 1,
            subtotal: menu.harga,
            gambar_url: menu.gambar_url,
            is_manual: false,
          },
        ];
      }
    });
    showToast(`"${menu.nama}" ditambahkan ke pesanan.`, 'info');
  };

  const total = items.reduce((sum, it) => sum + it.subtotal, 0);
  const totalItemCount = items.reduce((sum, it) => sum + it.jumlah, 0);

  // Save changes
  const handleSaveOrder = async () => {
    if (items.length === 0) {
      showToast('Pesanan tidak boleh kosong. Tambahkan minimal 1 item.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const updatedData: Partial<PesananAktif> = {
        nama_pelanggan: namaPelanggan.trim() || order.nama_pelanggan,
        tipe_pesanan: tipePesanan,
        nomor_meja: tipePesanan === 'Makan Di Tempat' ? (nomorMeja.trim() || undefined) : undefined,
        catatan: catatan.trim() || undefined,
        items,
        total,
      };

      // 1. Update active order in IndexedDB
      if (order.id) {
        await db.pesanan_aktif.update(order.id, updatedData);
      }

      // 2. If this order has a registered transaction, update it to keep financial reports consistent
      if (order.transaksi_id) {
        await db.transaksi.update(order.transaksi_id, {
          total,
          nominal_bayar: total,
          nama_pelanggan: namaPelanggan.trim() || order.nama_pelanggan,
          tipe_pesanan: tipePesanan,
          nomor_meja: tipePesanan === 'Makan Di Tempat' ? (nomorMeja.trim() || undefined) : undefined,
          catatan: catatan.trim() || undefined,
        });

        // Replace details for this transaction
        await db.detail_transaksi.where('transaksi_id').equals(order.transaksi_id).delete();
        for (const it of items) {
          await db.detail_transaksi.add({
            transaksi_id: order.transaksi_id,
            menu_id: it.menu_id ?? null,
            nama_item: it.nama,
            harga_satuan: it.harga,
            biaya_bahan_baku: it.biaya_bahan_baku || 0,
            jumlah: it.jumlah,
            subtotal: it.subtotal,
            is_manual: Boolean(it.is_manual),
          });
        }
      }

      showToast('Perubahan pesanan berhasil disimpan!', 'success');
      onSaved({
        ...order,
        ...updatedData,
      } as PesananAktif);
    } catch (err) {
      console.error('Failed to update active order:', err);
      showToast('Gagal menyimpan perubahan pesanan.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter catalog
  const filteredCatalog = menuList.filter((m) => {
    const matchCat = selectedCategory === 'Semua' || m.kategori === selectedCategory;
    const matchQuery = m.nama.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  return (
    <div className="pb-36 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-2 sm:pt-4 animate-in fade-in duration-150">
      {/* Top Header with Back button */}
      <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-xs mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsCancelDialogOpen(true)}
            className="flex items-center gap-1.5 py-2 px-3 sm:px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition active:scale-95 shrink-0"
            title="Kembali dan batalkan perubahan"
          >
            <ArrowLeft className="w-4 h-4 text-slate-700" />
            <span className="hidden sm:inline">Kembali</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                #{order.nomor_pesanan}
              </span>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                Mode Ubah Pesanan
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 truncate mt-0.5">
              Ubah Item Pesanan: {order.nama_pelanggan}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCancelDialogOpen(true)}
          className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition shrink-0"
        >
          Batalkan Ubah
        </button>
      </div>

      {/* Main Grid: Left is Item List & Order info, Right is Menu Catalog to add */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column (Items in order & Customer details) */}
        <div className="lg:col-span-5 space-y-4 order-2 lg:order-1">
          {/* Customer & Table details */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Informasi Pelanggan & Meja
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Nama Pelanggan
                </label>
                <input
                  type="text"
                  value={namaPelanggan}
                  onChange={(e) => setNamaPelanggan(e.target.value)}
                  placeholder="Nama Pelanggan"
                  className="w-full px-3 py-2 text-xs font-bold text-slate-900 border border-slate-200 rounded-xl outline-none focus:border-[#FF6038]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nomor Meja
                  </label>
                  <input
                    type="text"
                    value={nomorMeja}
                    onChange={(e) => setNomorMeja(e.target.value)}
                    placeholder="Contoh: 04"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-[#FF6038]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catatan Pesanan
                  </label>
                  <input
                    type="text"
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Contoh: Kurang manis"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-[#FF6038]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Current Items in the order */}
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#FF6038]" />
                <span>Daftar Menu Pesanan ({totalItemCount} item)</span>
              </h3>
              <span className="text-xs font-extrabold text-[#FF6038]">
                {formatRupiah(total)}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Tidak ada menu dalam pesanan. Silakan pilih menu di samping untuk menambahkan.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 truncate">{item.nama}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatRupiah(item.harga)} x {item.jumlah} ={' '}
                        <strong className="text-slate-800">{formatRupiah(item.subtotal)}</strong>
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center transition shadow-2xs active:scale-95"
                        title="Kurangi"
                      >
                        {item.jumlah === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <span className="w-6 text-center text-xs font-black text-slate-900">
                        {item.jumlah}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQty(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-orange-50 text-slate-700 hover:text-[#FF6038] flex items-center justify-center transition shadow-2xs active:scale-95"
                        title="Tambah"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Total summary and Save Button */}
            <div className="pt-4 mt-3 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500 font-semibold">Total Tagihan Baru:</span>
                <span className="text-xl font-black text-[#FF6038]">{formatRupiah(total)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelDialogOpen(true)}
                  className="py-3 px-3 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition active:scale-95 text-center"
                >
                  Batalkan
                </button>
                <button
                  type="button"
                  disabled={isSaving || items.length === 0}
                  onClick={handleSaveOrder}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Menu Catalog to Add Items */}
        <div className="lg:col-span-7 space-y-4 order-1 lg:order-2">
          <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-[#FF6038]" />
                  <span>Tambah Menu ke Pesanan</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Klik menu di bawah untuk menambahkan langsung ke daftar pesanan ini
                </p>
              </div>

              {/* Search catalog */}
              <div className="relative w-full sm:w-56">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari menu..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#FF6038]"
                />
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                    selectedCategory === cat
                      ? 'bg-[#FF6038] text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[500px] overflow-y-auto pr-1 pt-1">
              {filteredCatalog.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-400">
                  Menu tidak ditemukan.
                </div>
              ) : (
                filteredCatalog.map((menu) => {
                  const alreadyInOrder = items.find((it) => it.menu_id === menu.id);
                  return (
                    <div
                      key={menu.id}
                      onClick={() => handleAddMenuItem(menu)}
                      className="group bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-orange-300 rounded-2xl p-3 flex flex-col justify-between transition cursor-pointer active:scale-98 relative"
                    >
                      {alreadyInOrder && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#FF6038] text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                          {alreadyInOrder.jumlah}
                        </span>
                      )}

                      <div>
                        {menu.gambar_url ? (
                          <img
                            src={menu.gambar_url}
                            alt={menu.nama}
                            className="w-full h-20 object-cover rounded-xl mb-2"
                          />
                        ) : (
                          <div className="w-full h-16 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 flex flex-col items-center justify-center mb-2 p-1 text-center">
                            <ImageOff className="w-4 h-4 text-slate-300 mb-0.5" />
                            <span className="text-[8px] font-bold text-slate-400">Gambar tidak ada</span>
                          </div>
                        )}
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-[#FF6038] line-clamp-1">
                          {menu.nama}
                        </h4>
                        <span className="text-[10px] text-slate-400">{menu.kategori}</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-xs font-black text-slate-900">
                          {formatRupiah(menu.harga)}
                        </span>
                        <button
                          type="button"
                          className="w-6 h-6 rounded-lg bg-white border border-slate-200 group-hover:bg-[#FF6038] group-hover:text-white group-hover:border-[#FF6038] text-slate-700 flex items-center justify-center transition shadow-2xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP CONFIRMATION: "Yakin ingin batalkan ubah pesanan?" */}
      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-6 border border-slate-100 text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3.5">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-slate-900 mb-1.5 leading-snug">
              Yakin ingin batalkan ubah pesanan?
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Perubahan item dan rincian pesanan yang belum disimpan akan hilang dan pesanan tetap seperti semula.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsCancelDialogOpen(false)}
                className="py-3 px-3 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition active:scale-95"
              >
                Lanjut Mengubah
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCancelDialogOpen(false);
                  onBack();
                }}
                className="py-3 px-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-xs font-black text-white shadow-md shadow-rose-600/30 transition active:scale-95"
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
