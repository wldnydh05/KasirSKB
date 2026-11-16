/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Minus,
  Tag,
  QrCode,
  Banknote,
  CreditCard,
  Check,
  AlertCircle,
  Clock,
  FileText,
  Utensils,
  ShoppingBag,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { db } from '../../db';
import type { Promo, Transaksi, DetailTransaksi } from '../../types';
import { formatRupiah } from '../../utils/formatters';

interface CartBottomSheetProps {
  onTransactionSuccess: (tx: Transaksi, items: DetailTransaksi[]) => void;
}

export const CartBottomSheet: React.FC<CartBottomSheetProps> = ({ onTransactionSuccess }) => {
  const {
    items,
    updateQuantity,
    removeItem,
    clearCart,
    appliedPromo,
    setAppliedPromo,
    subtotal,
    discountAmount,
    total,
    totalItemsCount,
    activeOrderInfo,
    processCheckout,
    cancelActiveOrderContext,
  } = useCart();

  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal for Order & Payment (Triggered by (Bayar) button)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [tipePesanan, setTipePesanan] = useState<'Makan Di Tempat' | 'Bungkus'>('Makan Di Tempat');
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [orderTableNo, setOrderTableNo] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [cashGiven, setCashGiven] = useState<number | ''>('');

  // Load active promos
  useEffect(() => {
    async function fetchPromos() {
      const activePromos = await db.promo.where('aktif').equals(1).toArray();
      setPromos(activePromos);
    }
    fetchPromos();
  }, [isOpen]);

  // If no items in cart, collapse sheet
  useEffect(() => {
    if (items.length === 0 && isOpen) {
      setIsOpen(false);
    }
  }, [items.length]);

  if (items.length === 0) {
    return null;
  }

  const numericCash = typeof cashGiven === 'number' ? cashGiven : 0;
  const kembalian = numericCash >= total ? numericCash - total : 0;

  const quickBills = [
    total,
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    100000,
  ].filter((v, i, a) => v >= total && a.indexOf(v) === i);

  // Open Checkout Modal when user clicks "(Bayar)"
  const handleOpenCheckoutModal = () => {
    if (activeOrderInfo) {
      setOrderCustomerName(activeOrderInfo.nama_pelanggan);
      if (activeOrderInfo.tipe_pesanan) {
        setTipePesanan(activeOrderInfo.tipe_pesanan);
      }
    } else if (!orderCustomerName) {
      setOrderCustomerName('');
    }
    setCashGiven(total);
    setMetodePembayaran('Tunai');
    setIsCheckoutModalOpen(true);
  };

  // Submit payment & order: automatically saves into Pesanan and generates printable/shareable receipt
  const handleProceedPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (metodePembayaran === 'Tunai' && typeof cashGiven === 'number' && cashGiven < total) {
      showToast('Uang yang diterima kurang dari total belanja.', 'error');
      return;
    }

    setIsProcessing(true);
    const nominal =
      metodePembayaran === 'Tunai' && typeof cashGiven === 'number' ? cashGiven : total;

    const res = await processCheckout({
      namaPelanggan:
        orderCustomerName.trim() ||
        activeOrderInfo?.nama_pelanggan ||
        (tipePesanan === 'Bungkus' ? 'Pelanggan Bungkus' : 'Pelanggan Meja'),
      tipePesanan,
      nomorMeja: tipePesanan === 'Makan Di Tempat' ? orderTableNo.trim() || undefined : undefined,
      catatan: orderNotes.trim() || undefined,
      metodePembayaran,
      nominalBayar: nominal,
    });

    setIsProcessing(false);

    if (res.success && res.transaksi) {
      showToast(
        `Pesanan ${tipePesanan} berhasil dibuat & otomatis masuk ke Pesanan!`,
        'success'
      );
      setIsCheckoutModalOpen(false);
      setIsOpen(false);
      setOrderCustomerName('');
      setOrderTableNo('');
      setOrderNotes('');
      setCashGiven('');
      setTipePesanan('Makan Di Tempat');

      // Open receipt modal immediately for printing/sharing
      onTransactionSuccess(res.transaksi, res.receiptItems);
    } else {
      showToast('Gagal memproses pesanan.', 'error');
    }
  };

  return (
    <>
      {/* Backdrop when sheet is open */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs transition-opacity duration-200"
        />
      )}

      {/* Peek Bar & Expanded Bottom Sheet Container */}
      <div
        className={`fixed inset-x-0 transition-all duration-300 ease-in-out max-w-2xl mx-auto ${
          isOpen
            ? 'bottom-0 z-50 max-h-[88vh] flex flex-col bg-white rounded-t-3xl shadow-2xl border-t border-slate-200/90'
            : 'bottom-[74px] z-30 px-3 sm:px-4'
        }`}
      >
        {/* Peek Bar (Floats above Android quick access bottom bar when items > 0) */}
        {!isOpen ? (
          <div
            onClick={() => setIsOpen(true)}
            className="h-15 px-4 rounded-2xl bg-gradient-to-r from-[#FF6038] via-[#F3552D] to-[#E04620] text-white shadow-xl shadow-orange-500/30 flex items-center justify-between cursor-pointer hover:brightness-105 transition active:scale-[0.99] border border-orange-400/50"
          >
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white text-[#FF6038] shadow-md">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white border-2 border-white">
                  {totalItemsCount}
                </span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-orange-100">
                  {totalItemsCount} Item di Keranjang
                </div>
                <div className="text-sm sm:text-base font-black text-white">
                  {formatRupiah(total)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3.5 py-1.5 rounded-xl bg-slate-950 text-white text-xs font-black shadow-md flex items-center gap-1.5 hover:bg-slate-900 active:scale-95"
              >
                <span>Lihat Keranjang</span>
                <ChevronUp className="w-4 h-4 text-orange-400" />
              </button>
            </div>
          </div>
        ) : (
          /* Expanded Full Bottom Sheet */
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Drag handle & header */}
            <div className="p-4 pb-2 border-b border-slate-100 flex flex-col items-center">
              <div
                onClick={() => setIsOpen(false)}
                className="w-12 h-1.5 rounded-full bg-slate-300 cursor-pointer hover:bg-slate-400 transition mb-3"
              />
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-[#FF6038]" />
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Keranjang ({totalItemsCount} item)
                  </h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Segmented Toggle for Penyajian: Makan Di Tempat / Bungkus */}
            <div className="px-4 pt-2.5 pb-1 shrink-0">
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setTipePesanan('Makan Di Tempat')}
                  className={`min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                    tipePesanan === 'Makan Di Tempat'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Utensils className={`w-3.5 h-3.5 ${tipePesanan === 'Makan Di Tempat' ? 'text-[#FF6038]' : 'text-slate-500'}`} />
                  <span>Makan Di Tempat</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTipePesanan('Bungkus');
                    setOrderTableNo('');
                  }}
                  className={`min-h-[40px] py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                    tipePesanan === 'Bungkus'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShoppingBag className={`w-3.5 h-3.5 ${tipePesanan === 'Bungkus' ? 'text-[#FF6038]' : 'text-slate-500'}`} />
                  <span>Bungkus (Takeaway)</span>
                </button>
              </div>
            </div>

            {/* Active Order Notice if editing active order */}
            {activeOrderInfo && (
              <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Pesanan Aktif: <strong>#{activeOrderInfo.nomor_pesanan}</strong> ({activeOrderInfo.nama_pelanggan})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={cancelActiveOrderContext}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
                >
                  Batal Tautkan
                </button>
              </div>
            )}

            {/* Scrollable Items List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 divide-y divide-slate-100">
              {items.map((item, index) => (
                <div key={index} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {item.nama}
                      </span>
                      {item.is_manual && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">
                          Manual
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatRupiah(item.harga)} x {item.jumlah} ={' '}
                      <span className="font-semibold text-slate-700">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  </div>

                  {/* Stepper Controls */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                      <button
                        onClick={() => updateQuantity(index, -1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold text-slate-800">
                        {item.jumlah}
                      </span>
                      <button
                        onClick={() => updateQuantity(index, 1)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white active:scale-95 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(index)}
                      className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                      title="Hapus item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Promo Selector */}
            {promos.length > 0 && (
              <div className="px-4 py-2 bg-orange-50/50 border-t border-b border-orange-100/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-orange-800">
                  <Tag className="w-3.5 h-3.5 text-orange-600" />
                  <span>Promo:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <button
                    onClick={() => setAppliedPromo(null)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium transition ${
                      !appliedPromo
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    Tanpa Promo
                  </button>
                  {promos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setAppliedPromo(p)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                        appliedPromo?.id === p.id
                          ? 'bg-[#FF6038] text-white shadow-xs'
                          : 'bg-white border border-orange-200 text-orange-700 hover:bg-orange-100'
                      }`}
                    >
                      {p.nama}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Price summary & Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
              {/* Price summary */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Diskon Promo</span>
                    <span>-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total Bayar</span>
                  <span className="text-[#FF6038]">{formatRupiah(total)}</span>
                </div>
              </div>

              {/* Bottom Action Buttons: [ Kosongkan ] & [ (Bayar) ] */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearCart}
                  className="w-1/3 py-3 px-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-600 transition text-center shadow-2xs active:scale-95"
                >
                  Kosongkan
                </button>

                <button
                  type="button"
                  onClick={handleOpenCheckoutModal}
                  className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#FF6038] via-[#F3552D] to-[#E04620] hover:brightness-105 active:scale-[0.98] text-sm font-black text-white transition shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                >
                  <Banknote className="w-5 h-5 text-white" />
                  <span>(Bayar)</span>
                  <span className="text-xs font-semibold text-orange-100 ml-1">
                    {formatRupiah(total)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Informasi Pesanan & Pembayaran (Muncul saat tombol (Bayar) ditekan) */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl p-5 border border-slate-100 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6038] flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                    Detail Pesanan & Pembayaran
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Isi informasi pelanggan & metode pembayaran
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Form Scrollable */}
            <form onSubmit={handleProceedPayment} className="py-3 space-y-3.5 overflow-y-auto pr-1">
              {/* Pilihan: Makan Di Tempat atau Bungkus */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Pilihan Penyajian</span>
                  <span className="text-[11px] font-black text-[#FF6038]">
                    {tipePesanan === 'Makan Di Tempat' ? 'Dine In (Makan Di Tempat)' : 'Takeaway (Bungkus)'}
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipePesanan('Makan Di Tempat')}
                    className={`min-h-[52px] p-2.5 rounded-2xl border-2 flex items-center gap-2.5 transition active:scale-[0.98] text-left ${
                      tipePesanan === 'Makan Di Tempat'
                        ? 'border-[#FF6038] bg-orange-50/90 text-orange-950 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tipePesanan === 'Makan Di Tempat'
                          ? 'bg-[#FF6038] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Utensils className="w-4 h-4" />
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="text-xs font-black truncate">Makan Di Tempat</div>
                      <div className="text-[10px] text-slate-500 font-semibold truncate">Dine In (Meja)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTipePesanan('Bungkus');
                      setOrderTableNo('');
                    }}
                    className={`min-h-[52px] p-2.5 rounded-2xl border-2 flex items-center gap-2.5 transition active:scale-[0.98] text-left ${
                      tipePesanan === 'Bungkus'
                        ? 'border-[#FF6038] bg-orange-50/90 text-orange-950 shadow-xs ring-2 ring-orange-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        tipePesanan === 'Bungkus'
                          ? 'bg-[#FF6038] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="leading-tight min-w-0">
                      <div className="text-xs font-black truncate">Bungkus</div>
                      <div className="text-[10px] text-slate-500 font-semibold truncate">Takeaway / Bawa</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Nama Pelanggan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan / Antrian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={orderCustomerName}
                  onChange={(e) => setOrderCustomerName(e.target.value)}
                  placeholder={
                    tipePesanan === 'Makan Di Tempat'
                      ? 'Contoh: Mas Budi / Antrian #04'
                      : 'Contoh: Bpk. Joko (Bungkus) / Antrian #05'
                  }
                  className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-200 rounded-xl focus:border-[#FF6038] focus:ring-2 focus:ring-[#FF6038]/20 outline-none"
                  autoFocus
                />
              </div>

              {/* Nomor Meja & Catatan */}
              {tipePesanan === 'Makan Di Tempat' ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Meja <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={orderTableNo}
                      onChange={(e) => setOrderTableNo(e.target.value)}
                      placeholder="Contoh: 04"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#FF6038] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Catatan <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Contoh: Sambal dipisah"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#FF6038] outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Catatan Pesanan Bungkus <span className="text-slate-400 font-normal">(Opsional)</span>
                    </label>
                    <input
                      type="text"
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Contoh: Kuah dipisah, sendok plastik 2, sambal banyak"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-[#FF6038] outline-none"
                    />
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-950">
                    <ShoppingBag className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Pesanan <strong>Bungkus (Takeaway)</strong> akan dikemas untuk dibawa pulang tanpa perlu nomor meja.</span>
                  </div>
                </div>
              )}

              {/* Pilihan Metode Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodePembayaran('Tunai')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      metodePembayaran === 'Tunai'
                        ? 'border-[#FF6038] bg-orange-50 text-[#FF6038] shadow-2xs font-extrabold ring-1 ring-[#FF6038]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Tunai</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodePembayaran('QRIS')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      metodePembayaran === 'QRIS'
                        ? 'border-[#FF6038] bg-orange-50 text-[#FF6038] shadow-2xs font-extrabold ring-1 ring-[#FF6038]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QRIS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodePembayaran('Transfer')}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl text-xs font-bold border transition ${
                      metodePembayaran === 'Transfer'
                        ? 'border-[#FF6038] bg-orange-50 text-[#FF6038] shadow-2xs font-extrabold ring-1 ring-[#FF6038]'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer</span>
                  </button>
                </div>
              </div>

              {/* Form Input Tunai */}
              {metodePembayaran === 'Tunai' && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-700">Uang Diterima:</span>
                    <input
                      type="number"
                      value={cashGiven}
                      onChange={(e) =>
                        setCashGiven(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder={String(total)}
                      className="w-36 px-3 py-1.5 text-right text-sm font-extrabold text-slate-900 border border-slate-200 rounded-xl outline-none focus:border-[#FF6038] bg-white"
                    />
                  </div>

                  {/* Nominal Cepat */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                    <button
                      type="button"
                      onClick={() => setCashGiven(total)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                    >
                      Uang Pas
                    </button>
                    {quickBills.map((bill, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCashGiven(bill)}
                        className="px-2.5 py-1 rounded-lg bg-orange-50 text-[11px] font-bold text-orange-800 hover:bg-orange-100 whitespace-nowrap border border-orange-200"
                      >
                        {formatRupiah(bill)}
                      </button>
                    ))}
                  </div>

                  {/* Kembalian */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Kembalian:</span>
                    <span
                      className={`text-sm font-black ${
                        kembalian > 0 ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {formatRupiah(kembalian)}
                    </span>
                  </div>
                </div>
              )}

              {/* Info QRIS */}
              {metodePembayaran === 'QRIS' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-800">QRIS Statis UMKM Siap</div>
                    <p className="text-slate-500 text-[11px]">
                      Tunjukkan QR kepada pelanggan untuk nominal {formatRupiah(total)}.
                    </p>
                  </div>
                </div>
              )}

              {/* Info Transfer */}
              {metodePembayaran === 'Transfer' && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#FF6038] text-white flex items-center justify-center shrink-0">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-800">Transfer Bank / E-Wallet</div>
                    <p className="text-slate-500 text-[11px]">
                      Konfirmasi mutasi rekening untuk total {formatRupiah(total)}.
                    </p>
                  </div>
                </div>
              )}

              {/* Ringkasan Total Tagihan */}
              <div className="p-3 bg-slate-100 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Total Tagihan ({totalItemsCount} item)</span>
                  <div className="text-base font-black text-slate-900">
                    {formatRupiah(total)}
                  </div>
                </div>
                <span className="text-[11px] font-bold px-2 py-1 bg-white rounded-lg border border-slate-200 text-slate-700">
                  {metodePembayaran}
                </span>
              </div>

              {/* Action Buttons: [ Batal ] & [ Lanjut ] */}
              <div className="pt-2 grid grid-cols-2 gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="py-3 px-3 rounded-2xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition active:scale-95 text-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isProcessing ? 'Memproses...' : 'Lanjut & Cetak Struk'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

