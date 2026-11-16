/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  Receipt,
  Printer,
  Utensils,
  Trash2,
  Edit,
  DollarSign,
  User,
  ShoppingBag,
  RotateCcw,
  Calendar,
  Store,
} from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { PesananAktif, Transaksi, DetailTransaksi } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useCabang } from '../../context/CabangContext';
import { useToast } from '../../context/ToastContext';
import { ReceiptModal } from '../kasir/ReceiptModal';
import { EditPesananView } from './EditPesananView';
import type { NavTab } from '../common/Navbar';

interface PesananManagerViewProps {
  onNavigateToKasir: () => void;
  defaultSubTab?: 'aktif' | 'selesai';
}

export const PesananManagerView: React.FC<PesananManagerViewProps> = ({
  onNavigateToKasir,
  defaultSubTab = 'aktif',
}) => {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { selectedCabangFilter, setSelectedCabangFilter, cabangList, activeCashierCabang } = useCabang();
  const { loadActiveOrderToCart, saveTransaction } = useCart();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'aktif' | 'selesai'>(defaultSubTab);

  // Dedicated Editing View for Active Order
  const [editingOrder, setEditingOrder] = useState<PesananAktif | null>(null);

  // 1. State for Pesanan Aktif
  const [activeOrders, setActiveOrders] = useState<PesananAktif[]>([]);
  const [isLoadingActive, setIsLoadingActive] = useState(true);

  // Cancellation modal state for active order
  const [orderToCancel, setOrderToCancel] = useState<PesananAktif | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Quick Pay Modal for Active Order
  const [payingOrder, setPayingOrder] = useState<PesananAktif | null>(null);
  const [metodeBayar, setMetodeBayar] = useState<'Tunai' | 'QRIS' | 'Transfer'>('Tunai');
  const [nominalDiterima, setNominalDiterima] = useState<number | ''>('');
  const [isProcessingPay, setIsProcessingPay] = useState(false);

  // 2. State for Riwayat Pesanan (Lunas)
  const [period, setPeriod] = useState<'hari-ini' | '30-hari' | 'custom'>('hari-ini');
  const [customStartDate, setCustomStartDate] = useState<string>(() => getFormattedDate(new Date()));
  const [customEndDate, setCustomEndDate] = useState<string>(() => getFormattedDate(new Date()));
  const [searchHistory, setSearchHistory] = useState('');
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [txDetailsMap, setTxDetailsMap] = useState<Record<number, DetailTransaksi[]>>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Delete transaction modal state for Riwayat Pesanan
  const [txToDelete, setTxToDelete] = useState<Transaksi | null>(null);
  const [isDeletingTx, setIsDeletingTx] = useState(false);

  // Receipt modal state
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);
  const [selectedTxItems, setSelectedTxItems] = useState<DetailTransaksi[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Load Pesanan Aktif (FIFO: Urutan Datang)
  // A (pertama pesan) tetap di paling atas, B di bawah A, dan C (terakhir pesan) paling bawah
  const loadActiveOrders = async () => {
    setIsLoadingActive(true);
    try {
      const orders = await db.pesanan_aktif.toArray();
      orders.sort((a, b) => {
        if (a.id && b.id) return a.id - b.id;
        return (a.created_at || '').localeCompare(b.created_at || '');
      });
      setActiveOrders(orders);
    } catch (err) {
      console.error('Failed to load active orders', err);
    } finally {
      setIsLoadingActive(false);
    }
  };

  // Load Riwayat Pesanan
  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const today = new Date();
      let startDateStr = getFormattedDate(today);
      let endDateStr = getFormattedDate(today);

      if (period === '30-hari') {
        const past30 = new Date(today);
        past30.setDate(today.getDate() - 30);
        startDateStr = getFormattedDate(past30);
      } else if (period === 'custom') {
        startDateStr = customStartDate || getFormattedDate(today);
        endDateStr = customEndDate || getFormattedDate(today);
        if (startDateStr > endDateStr) {
          const temp = startDateStr;
          startDateStr = endDateStr;
          endDateStr = temp;
        }
      }

      const txList = await db.transaksi
        .where('tanggal')
        .between(startDateStr, endDateStr, true, true)
        .reverse()
        .toArray();

      setTransactions(txList);

      const txIds = txList.map((t) => t.id!).filter(Boolean);
      if (txIds.length > 0) {
        const details = await db.detail_transaksi
          .where('transaksi_id')
          .anyOf(txIds)
          .toArray();

        const map: Record<number, DetailTransaksi[]> = {};
        for (const d of details) {
          if (!map[d.transaksi_id]) {
            map[d.transaksi_id] = [];
          }
          map[d.transaksi_id].push(d);
        }
        setTxDetailsMap(map);
      } else {
        setTxDetailsMap({});
      }
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadActiveOrders();
    loadHistory();

    // Auto-refresh active queue every 3 seconds so incoming orders show up in queue seamlessly
    const interval = setInterval(() => {
      loadActiveOrders();
    }, 3000);
    return () => clearInterval(interval);
  }, [period, customStartDate, customEndDate]);

  // Handle Edit/Add items to active order via dedicated EditPesananView
  const handleEditActiveOrder = (order: PesananAktif) => {
    setEditingOrder(order);
  };

  // Handle Void / Cancel Active Order (open in-app modal)
  const handleCancelActiveOrder = (order: PesananAktif) => {
    setOrderToCancel(order);
  };

  // Confirm cancel active order
  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel) return;
    setIsCancelling(true);
    try {
      if (orderToCancel.id) {
        await db.pesanan_aktif.delete(orderToCancel.id);
      }
      if (orderToCancel.transaksi_id) {
        await db.transaksi.delete(orderToCancel.transaksi_id);
        await db.detail_transaksi.where('transaksi_id').equals(orderToCancel.transaksi_id).delete();
      }
      showToast(`Pesanan #${orderToCancel.nomor_pesanan} (${orderToCancel.nama_pelanggan}) berhasil dibatalkan.`, 'info');
      setOrderToCancel(null);
      await loadActiveOrders();
      await loadHistory();
    } catch (err) {
      console.error('Failed to cancel order:', err);
      showToast('Gagal membatalkan pesanan.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Delete Completed Transaction from History
  const handleConfirmDeleteTx = async () => {
    if (!txToDelete || !txToDelete.id) return;
    setIsDeletingTx(true);
    try {
      const deletedId = txToDelete.id;
      await db.transaction('rw', db.transaksi, db.detail_transaksi, async () => {
        await db.transaksi.delete(deletedId);
        await db.detail_transaksi.where('transaksi_id').equals(deletedId).delete();
      });
      showToast(`Transaksi #${deletedId} berhasil dihapus dari riwayat.`, 'info');
      setTxToDelete(null);
      await loadHistory();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      showToast('Gagal menghapus transaksi.', 'error');
    } finally {
      setIsDeletingTx(false);
    }
  };

  // Print Receipt for Active Order
  // Print Receipt for Active Order
  const handlePrintActiveOrderReceipt = (order: PesananAktif) => {
    const txData: Transaksi = {
      id: order.transaksi_id,
      nomor_pesanan: order.nomor_pesanan,
      tanggal: order.tanggal,
      waktu: order.waktu,
      total: order.total,
      user_id: order.user_id,
      user_name: order.user_name || 'Kasir',
      metode_pembayaran: order.metode_pembayaran || 'Tunai',
      nominal_bayar: order.nominal_bayar || order.total,
      kembalian: order.kembalian || 0,
      nama_pelanggan: order.nama_pelanggan,
      tipe_pesanan: order.tipe_pesanan,
      nomor_meja: order.nomor_meja,
      catatan: order.catatan,
      cabang: order.cabang || activeCashierCabang,
      created_at: order.created_at,
    };

    const txItems: DetailTransaksi[] = (order.items || []).map((it) => ({
      transaksi_id: order.transaksi_id || 0,
      nama_item: it.nama,
      harga_satuan: it.harga,
      jumlah: it.jumlah,
      subtotal: it.subtotal,
      is_manual: Boolean(it.is_manual),
    }));

    setSelectedTx(txData);
    setSelectedTxItems(txItems);
    setIsReceiptOpen(true);
  };

  // Handle Mark Active Order Completed / Served
  const handleMarkOrderCompleted = async (order: PesananAktif) => {
    if (order.id) {
      await db.pesanan_aktif.delete(order.id);
      showToast(`Pesanan #${order.nomor_pesanan} (${order.nama_pelanggan}) selesai disajikan!`, 'success');
      loadActiveOrders();
    }
  };

  // Open Quick Pay Modal for Active Order
  const handleOpenQuickPay = (order: PesananAktif) => {
    setPayingOrder(order);
    setMetodeBayar('Tunai');
    setNominalDiterima(order.total);
  };

  // Process Quick Payment for Active Order
  const handleProcessQuickPay = async () => {
    if (!payingOrder) return;

    const nominal = typeof nominalDiterima === 'number' ? nominalDiterima : payingOrder.total;
    if (metodeBayar === 'Tunai' && nominal < payingOrder.total) {
      showToast('Nominal uang diterima kurang dari total pesanan.', 'error');
      return;
    }

    setIsProcessingPay(true);
    try {
      const todayDate = new Date();
      const tanggal = getFormattedDate(todayDate);
      const waktu = todayDate.toTimeString().split(' ')[0];
      const nowIso = todayDate.toISOString();
      const txCabang = payingOrder.cabang || activeCashierCabang;

      let createdTxId: number | undefined;

      await db.transaction('rw', db.transaksi, db.detail_transaksi, db.pesanan_aktif, async () => {
        createdTxId = await db.transaksi.add({
          tanggal,
          waktu,
          total: payingOrder.total,
          user_id: payingOrder.user_id,
          user_name: payingOrder.user_name || 'Kasir',
          metode_pembayaran: metodeBayar,
          nominal_bayar: nominal,
          kembalian: nominal - payingOrder.total,
          nama_pelanggan: payingOrder.nama_pelanggan,
          tipe_pesanan: payingOrder.tipe_pesanan,
          nomor_meja: payingOrder.nomor_meja,
          catatan: payingOrder.catatan,
          cabang: txCabang,
          created_at: nowIso,
        });

        for (const item of payingOrder.items) {
          await db.detail_transaksi.add({
            transaksi_id: createdTxId,
            menu_id: item.menu_id ?? null,
            nama_item: item.nama,
            harga_satuan: item.harga,
            biaya_bahan_baku: item.biaya_bahan_baku || 0,
            jumlah: item.jumlah,
            subtotal: item.subtotal,
            is_manual: Boolean(item.is_manual),
          });
        }

        // Remove from active orders
        if (payingOrder.id) {
          await db.pesanan_aktif.delete(payingOrder.id);
        }
      });

      showToast(`Transaksi ${payingOrder.nomor_pesanan} (${txCabang}) selesai & lunas!`, 'success');

      // Refresh both lists
      loadActiveOrders();
      loadHistory();

      // Show receipt
      const receiptData: Transaksi = {
        id: createdTxId,
        tanggal,
        waktu,
        total: payingOrder.total,
        user_id: payingOrder.user_id,
        user_name: payingOrder.user_name,
        metode_pembayaran: metodeBayar,
        nominal_bayar: nominal,
        kembalian: nominal - payingOrder.total,
        nama_pelanggan: payingOrder.nama_pelanggan,
        tipe_pesanan: payingOrder.tipe_pesanan,
        nomor_meja: payingOrder.nomor_meja,
        catatan: payingOrder.catatan,
        cabang: txCabang,
        created_at: nowIso,
      };

      const receiptItems: DetailTransaksi[] = payingOrder.items.map((it) => ({
        transaksi_id: createdTxId!,
        nama_item: it.nama,
        harga_satuan: it.harga,
        jumlah: it.jumlah,
        subtotal: it.subtotal,
        is_manual: Boolean(it.is_manual),
      }));

      setSelectedTx(receiptData);
      setSelectedTxItems(receiptItems);
      setIsReceiptOpen(true);
      setPayingOrder(null);
    } catch (err) {
      console.error('Failed to complete active order payment:', err);
      showToast('Gagal memproses pembayaran.', 'error');
    } finally {
      setIsProcessingPay(false);
    }
  };

  // Branch filter logic
  const effectiveCabangFilter = isOwner ? selectedCabangFilter : activeCashierCabang;

  const displayedActiveOrders = activeOrders.filter((order) => {
    if (effectiveCabangFilter === 'Semua') return true;
    return (order.cabang || 'Cabang 1') === effectiveCabangFilter;
  });

  // Filter Completed History
  const filteredHistory = transactions.filter((tx) => {
    if (effectiveCabangFilter !== 'Semua' && (tx.cabang || 'Cabang 1') !== effectiveCabangFilter) {
      return false;
    }
    const items = txDetailsMap[tx.id!] || [];
    const itemNames = items.map((i) => i.nama_item).join(' ').toLowerCase();
    const query = searchHistory.toLowerCase();
    return (
      String(tx.id).includes(query) ||
      (tx.metode_pembayaran || '').toLowerCase().includes(query) ||
      (tx.user_name || '').toLowerCase().includes(query) ||
      (tx.cabang || '').toLowerCase().includes(query) ||
      itemNames.includes(query)
    );
  });

  const totalOmzetLunas = filteredHistory.reduce((sum, tx) => sum + tx.total, 0);

  // If currently editing an active order, render the dedicated EditPesananView
  if (editingOrder) {
    return (
      <EditPesananView
        order={editingOrder}
        onBack={() => setEditingOrder(null)}
        onSaved={() => {
          setEditingOrder(null);
          loadActiveOrders();
          loadHistory();
        }}
      />
    );
  }

  return (
    <div className="pb-32 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Top Header - Clean, Phone-Friendly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--teks)] tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[var(--utama-teks)] shrink-0" />
            <span>Pusat Pesanan</span>
          </h1>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Kelola pesanan aktif yang diproses dapur dan riwayat transaksi pesanan.
          </p>
        </div>
      </div>

      {/* Segmented Switcher: Pesanan Aktif vs Riwayat Pesanan */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[var(--garis)]/90 rounded-2xl mb-3 max-w-md mx-auto sm:mx-0 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('aktif')}
          className={`relative flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 active:scale-95 ${
            activeTab === 'aktif'
              ? 'bg-[var(--utama)] text-white shadow-md shadow-[var(--utama)]/25 ring-2 ring-white/60'
              : 'text-[var(--teks)] hover:text-[var(--teks)] hover:bg-[var(--garis-kuat)]/60'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span>Pesanan Aktif</span>
          {displayedActiveOrders.length > 0 && (
            <span
              className={`px-1.5 py-0.5 min-w-[20px] text-center rounded-full text-[11px] font-black leading-none ${
                activeTab === 'aktif' ? 'bg-[var(--nav)] text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {displayedActiveOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('selesai')}
          className={`relative flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 active:scale-95 ${
            activeTab === 'selesai'
              ? 'bg-[var(--nav)] text-white shadow-md ring-2 ring-white/60'
              : 'text-[var(--teks)] hover:text-[var(--teks)] hover:bg-[var(--garis-kuat)]/60'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Riwayat Pesanan</span>
        </button>
      </div>

      {/* Branch Selector for Owner / Branch Indicator for Staff */}
      {isOwner ? (
        <div className="flex items-center gap-1.5 p-1.5 bg-[var(--kartu)] border border-[var(--garis)]/90 rounded-2xl mb-4 overflow-x-auto shadow-2xs">
          <div className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[var(--redup)] shrink-0">
            <Store className="w-3.5 h-3.5 text-[var(--utama-teks)]" />
            <span>Pantau Cabang:</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCabangFilter('Semua')}
            className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
              selectedCabangFilter === 'Semua'
                ? 'bg-[var(--nav)] text-white shadow-xs'
                : 'text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)]'
            }`}
          >
            Semua Cabang
          </button>
          {cabangList.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCabangFilter(c)}
              className={`min-h-[36px] px-3.5 py-1 rounded-xl text-xs font-black transition-all shrink-0 ${
                selectedCabangFilter === c
                  ? 'bg-[var(--utama)] text-white shadow-xs shadow-[var(--utama)]/20'
                  : 'text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 px-3 bg-amber-50/80 border border-amber-200/80 rounded-2xl mb-4 text-xs font-bold text-amber-950 shadow-2xs">
          <Store className="w-4 h-4 text-[var(--utama-teks)] shrink-0" />
          <span>Akun Kasir Aktif: <strong className="text-[var(--teks)] font-black">{activeCashierCabang}</strong></span>
          <span className="text-[10px] text-amber-700 font-semibold ml-auto hidden sm:inline">(Hanya transaksi cabang ini)</span>
        </div>
      )}

      {/* TAB 1: PESANAN AKTIF (ACTIVE ORDERS) */}
      {activeTab === 'aktif' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Subtle Compact Guide for Mobile Users */}
          <div className="bg-emerald-50/90 border border-emerald-200/70 rounded-2xl p-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <p className="text-[11px] text-emerald-900 leading-snug">
              Daftar pesanan aktif yang sedang disiapkan. Tekan <strong>Ubah</strong> untuk edit item atau <strong>Selesai Disajikan</strong> jika hidangan sudah diantar.
            </p>
          </div>

          {isLoadingActive ? (
            <div className="py-12 text-center text-xs text-[var(--redup)]">Memuat pesanan aktif...</div>
          ) : displayedActiveOrders.length === 0 ? (
            <div className="text-center py-16 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-6 sm:p-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-[var(--teks)]">
                {effectiveCabangFilter === 'Semua' ? 'Semua Pesanan Selesai!' : `Tidak Ada Pesanan Aktif di ${effectiveCabangFilter}`}
              </h4>
              <p className="text-xs text-[var(--redup)] mt-1 max-w-sm mx-auto leading-relaxed">
                {effectiveCabangFilter === 'Semua'
                  ? 'Tidak ada pesanan aktif saat ini. Pesanan baru dapat dibuat langsung melalui menu Kasir.'
                  : `Semua pesanan di ${effectiveCabangFilter} telah disajikan atau diselesaikan pembayarannya.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {displayedActiveOrders.map((order) => {
                const isPaid = order.status === 'diproses';
                const branchName = order.cabang || 'Cabang 1';
                return (
                  <div
                    key={order.id}
                    className="bg-[var(--kartu)] rounded-3xl p-4 sm:p-5 border border-[var(--garis)]/90 shadow-xs flex flex-col justify-between hover:shadow-md transition"
                  >
                    <div>
                      {/* Header Card: Order # & Status */}
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--garis)] gap-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                          <span className="font-mono font-black text-xs text-[var(--teks)] bg-[var(--latar)] px-2.5 py-1 rounded-lg shrink-0">
                            #{order.nomor_pesanan}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                              branchName === 'Cabang 1'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200/80'
                                : 'bg-indigo-100 text-indigo-900 border border-indigo-200/80'
                            }`}
                          >
                            <Store className="w-3 h-3 shrink-0" />
                            {branchName}
                          </span>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full truncate">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">Lunas ({order.metode_pembayaran || 'Kasir'})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-full shrink-0">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span>Belum Bayar</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[var(--redup)] font-semibold shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{order.waktu}</span>
                        </div>
                      </div>

                      {/* Customer & Service Type */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-black text-base text-[var(--teks)] truncate">
                            {order.nama_pelanggan || 'Pelanggan'}
                          </h3>
                          {order.tipe_pesanan === 'Bungkus' || (!order.tipe_pesanan && !order.nomor_meja) ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200/80 px-2.5 py-0.5 rounded-lg shrink-0">
                              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                              <span>Bungkus</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--teks)] bg-[var(--latar)] border border-[var(--garis)]/80 px-2.5 py-0.5 rounded-lg shrink-0">
                              <Utensils className="w-3.5 h-3.5 text-[var(--redup)]" />
                              <span>Meja {order.nomor_meja || '-'}</span>
                            </span>
                          )}
                        </div>
                        {order.catatan && (
                          <p className="text-xs text-amber-900 bg-amber-50/90 p-2 rounded-xl mt-2 border border-amber-200/60 italic leading-snug">
                            "{order.catatan}"
                          </p>
                        )}
                      </div>

                      {/* Items List - Mobile friendly clean receipt style */}
                      <div className="mt-3.5 bg-[var(--latar)]/70 rounded-2xl p-3 border border-[var(--garis)] space-y-2">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-start text-xs gap-2">
                            <span className="text-[var(--teks)] font-medium leading-tight flex-1">
                              <span className="font-black text-[var(--utama-teks)] bg-[var(--utama-muda)]/80 px-1.5 py-0.5 rounded mr-1">
                                {it.jumlah}x
                              </span>{' '}
                              {it.nama}
                            </span>
                            <span className="font-bold text-[var(--teks)] shrink-0">
                              {formatRupiah(it.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total & Ergonomic Mobile Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-[var(--garis)] space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-[var(--redup)] font-medium">
                          {isPaid ? 'Total Transaksi:' : 'Tagihan Belum Dibayar:'}
                        </span>
                        <span
                          className={`text-lg font-black ${
                            isPaid ? 'text-[var(--teks)]' : 'text-[var(--utama-teks)]'
                          }`}
                        >
                          {formatRupiah(order.total)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {/* Active order action buttons */}
                        {isOwner ? (
                          /* OWNER READ-ONLY VIEW */
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handlePrintActiveOrderReceipt(order)}
                              className="w-full min-h-[44px] py-2 px-3 rounded-xl border border-sky-200 bg-sky-50/90 hover:bg-sky-100 active:scale-95 text-xs font-bold text-sky-800 flex items-center justify-center gap-2 transition shadow-2xs"
                              title="Cetak atau lihat struk pesanan ini"
                            >
                              <Printer className="w-4 h-4 text-sky-600 shrink-0" />
                              <span>Cetak / Lihat Struk Pesanan</span>
                            </button>

                            <div className="bg-[var(--latar)] border border-[var(--garis)]/80 rounded-xl py-2 px-3 text-center">
                              <span className="text-[11px] font-bold text-[var(--redup)] flex items-center justify-center gap-1.5">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    isPaid ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'
                                  }`}
                                />
                                Status Operasional: {isPaid ? 'Sedang Diproses Dapur' : 'Menunggu Kasir'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* STAFF ACTION BUTTONS */
                          <>
                            {/* Row 1: Quick Actions (Ubah, Struk, Batalkan) */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditActiveOrder(order)}
                                className="flex-1 min-h-[44px] py-2 px-2.5 rounded-xl border border-[var(--garis)] bg-[var(--kartu)] hover:bg-[var(--latar)] active:scale-95 text-xs font-bold text-[var(--teks)] flex items-center justify-center gap-1.5 transition shadow-2xs"
                                title="Ubah item pesanan"
                              >
                                <Edit className="w-3.5 h-3.5 text-[var(--redup)] shrink-0" />
                                <span>Ubah Item</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrintActiveOrderReceipt(order)}
                                className="flex-1 min-h-[44px] py-2 px-2.5 rounded-xl border border-sky-200 bg-sky-50/80 hover:bg-sky-100 active:scale-95 text-xs font-bold text-sky-800 flex items-center justify-center gap-1.5 transition shadow-2xs"
                                title="Cetak struk pesanan ini"
                              >
                                <Printer className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>Cetak Struk</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCancelActiveOrder(order)}
                                className="min-h-[44px] px-3 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 active:scale-95 text-xs font-bold text-rose-700 flex items-center justify-center gap-1 transition shadow-2xs"
                                title="Batalkan pesanan ini"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span className="hidden sm:inline">Batal</span>
                              </button>
                            </div>

                            {/* Row 2: Primary Large Action Button */}
                            {isPaid ? (
                              <button
                                type="button"
                                onClick={() => handleMarkOrderCompleted(order)}
                                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-90 active:scale-[0.98] text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition"
                              >
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Pesanan Selesai Disajikan</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickPay(order)}
                                className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-gradient-to-r from-[var(--utama)] to-[var(--utama-tua)] hover:brightness-105 active:scale-[0.98] text-xs sm:text-sm font-black text-white flex items-center justify-center gap-2 shadow-md shadow-[var(--utama)]/30 transition"
                              >
                                <DollarSign className="w-4 h-4 shrink-0" />
                                <span>Selesaikan Transaksi (Bayar)</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT PESANAN (COMPLETED ORDERS) */}
      {activeTab === 'selesai' && (
        <div className="space-y-3.5 animate-in fade-in duration-150">
          {/* Filters, Search & Metrics - Phone Friendly */}
          <div className="bg-[var(--kartu)] rounded-3xl p-3.5 sm:p-5 border border-[var(--garis)]/90 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Period chips */}
              <div className="grid grid-cols-3 gap-1 bg-[var(--latar)] p-1 rounded-2xl w-full sm:w-auto">
                {(
                  [
                    { id: 'hari-ini' as const, label: 'Hari Ini' },
                    { id: '30-hari' as const, label: '30 Hari' },
                    { id: 'custom' as const, label: 'Pilih Tanggal' },
                  ]
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id)}
                    className={`min-h-[38px] px-2 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                      period === p.id
                        ? 'bg-[var(--kartu)] text-[var(--teks)] shadow-xs'
                        : 'text-[var(--redup)] hover:text-[var(--teks)]'
                    }`}
                  >
                    {p.id === 'custom' && <Calendar className="w-3.5 h-3.5 text-[var(--utama-teks)]" />}
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--redup)]" />
                <input
                  type="text"
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  placeholder="Cari ID nota, kasir, atau menu..."
                  className="w-full min-h-[40px] pl-9 pr-8 py-2 text-xs rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--latar)]/50 focus:bg-[var(--kartu)] transition"
                />
                {searchHistory && (
                  <button
                    onClick={() => setSearchHistory('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--redup)] hover:text-[var(--redup)] text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {period === 'custom' && (
              <div className="bg-[var(--utama-muda)]/70 border border-[var(--garis)]/80 rounded-2xl p-3 sm:p-3.5 space-y-2 w-full min-w-0 overflow-hidden animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--utama-teks)]">
                  <Calendar className="w-4 h-4 text-[var(--utama-teks)] shrink-0" />
                  <span>Pilih Rentang Tanggal:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
                  <div className="min-w-0">
                    <label className="text-[10px] font-semibold text-[var(--redup)] block mb-1 truncate">Dari Tanggal</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full min-w-0 max-w-full min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="text-[10px] font-semibold text-[var(--redup)] block mb-1 truncate">Sampai Tanggal</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full min-w-0 max-w-full min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Total Omzet & Pesanan Summary */}
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[var(--garis)]">
              <div className="p-2.5 bg-[var(--latar)] rounded-2xl">
                <span className="text-[11px] text-[var(--redup)] font-semibold block">Total Selesai</span>
                <span className="text-sm sm:text-base font-black text-[var(--teks)]">
                  {filteredHistory.length} Pesanan
                </span>
              </div>
              <div className="p-2.5 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-right">
                <span className="text-[11px] text-emerald-800 font-semibold block">Total Omzet Lunas</span>
                <span className="text-sm sm:text-base font-black text-emerald-700">
                  {formatRupiah(totalOmzetLunas)}
                </span>
              </div>
            </div>
          </div>

          {/* History List - Mobile Friendly Card Layout */}
          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs text-[var(--redup)]">Memuat riwayat pesanan...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-16 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-6 sm:p-8">
              <Receipt className="w-12 h-12 text-[var(--redup)] mx-auto mb-2" />
              <h4 className="text-base font-black text-[var(--teks)]">Belum Ada Riwayat Pesanan</h4>
              <p className="text-xs text-[var(--redup)] mt-1 max-w-sm mx-auto leading-relaxed">
                Pesanan yang telah diselesaikan pembayarannya akan tercatat rapi secara permanen di sini.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHistory.map((tx) => {
                const items = txDetailsMap[tx.id!] || [];
                const itemSummary =
                  items.length > 0
                    ? items
                        .slice(0, 2)
                        .map((it) => `${it.jumlah}x ${it.nama_item}`)
                        .join(', ') + (items.length > 2 ? ` (+${items.length - 2} menu lain)` : '')
                    : '1 item pesanan';

                return (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setSelectedTx(tx);
                      setSelectedTxItems(items);
                      setIsReceiptOpen(true);
                    }}
                    className="bg-[var(--kartu)] rounded-2xl p-3.5 sm:p-4 border border-[var(--garis)]/90 hover:border-emerald-300 hover:shadow-xs transition cursor-pointer active:scale-[0.99] group"
                  >
                    {/* Top Row: ID, Badges, Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-[var(--teks)] bg-[var(--latar)] px-2 py-0.5 rounded-md">
                          #{tx.id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                            (tx.cabang || 'Cabang 1') === 'Cabang 1'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200/80'
                              : 'bg-indigo-100 text-indigo-900 border border-indigo-200/80'
                          }`}
                        >
                          <Store className="w-3 h-3 shrink-0" />
                          {tx.cabang || 'Cabang 1'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Lunas
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[var(--latar)] text-[var(--teks)]">
                          {tx.metode_pembayaran || 'Tunai'}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--redup)] font-medium shrink-0">
                        {tx.waktu}
                      </span>
                    </div>

                    {/* Middle Row: Items summary & customer */}
                    <div className="mb-2.5">
                      <p className="text-xs text-[var(--teks)] font-bold leading-tight">
                        {itemSummary}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--redup)] mt-1 flex-wrap">
                        {tx.nama_pelanggan && (
                          <span className="text-[var(--redup)] font-semibold truncate">
                            Pelanggan: {tx.nama_pelanggan}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--teks)] bg-[var(--latar)] px-1.5 py-0.5 rounded text-[10px]">
                          {tx.tipe_pesanan === 'Bungkus' || (!tx.tipe_pesanan && !tx.nomor_meja) ? (
                            <>
                              <ShoppingBag className="w-3 h-3 text-amber-600" />
                              <span>Bungkus</span>
                            </>
                          ) : (
                            <>
                              <Utensils className="w-3 h-3 text-[var(--redup)]" />
                              <span>Meja {tx.nomor_meja || '-'}</span>
                            </>
                          )}
                        </span>
                        <span>· Kasir: {tx.user_name || 'Staff'}</span>
                      </div>
                    </div>

                    {/* Bottom Row: Total & Action Buttons */}
                    <div className="pt-2 border-t border-[var(--garis)] flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-[var(--redup)] font-medium block">Total Bayar</span>
                        <span className="text-sm font-black text-[var(--teks)] group-hover:text-emerald-600 transition">
                          {formatRupiah(tx.total)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTx(tx);
                            setSelectedTxItems(items);
                            setIsReceiptOpen(true);
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[var(--latar)] group-hover:bg-emerald-50 text-[var(--teks)] group-hover:text-emerald-700 border border-[var(--garis)] group-hover:border-emerald-200 text-xs font-extrabold flex items-center gap-1.5 transition active:scale-95"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Lihat Struk</span>
                        </button>

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTxToDelete(tx);
                            }}
                            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition active:scale-95"
                            title="Hapus transaksi ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Hapus</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QUICK PAY MODAL FOR ACTIVE ORDER */}
      {payingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-5 border border-[var(--garis)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--garis)]">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Selesaikan Transaksi
                </span>
                <h3 className="text-base font-black text-[var(--teks)]">
                  {payingOrder.nama_pelanggan || 'Pelanggan'}
                </h3>
              </div>
              <button
                onClick={() => setPayingOrder(null)}
                className="w-8 h-8 rounded-xl bg-[var(--latar)] hover:bg-[var(--garis)] text-[var(--redup)] flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>

            <div className="py-3 space-y-3 text-xs">
              <div className="p-3 bg-[var(--utama-muda)] rounded-2xl flex justify-between items-center">
                <span className="font-semibold text-[var(--utama-teks)]">Total Tagihan:</span>
                <span className="text-lg font-black text-[var(--utama-teks)]">
                  {formatRupiah(payingOrder.total)}
                </span>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-[var(--redup)] font-semibold mb-1">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Tunai', 'QRIS', 'Transfer'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetodeBayar(m)}
                      className={`min-h-[42px] py-2 text-xs font-bold rounded-xl border transition active:scale-95 ${
                        metodeBayar === m
                          ? 'bg-[var(--utama)] text-white border-[var(--utama-teks)] shadow-xs'
                          : 'bg-[var(--latar)] border-[var(--garis)] text-[var(--teks)] hover:bg-[var(--latar)]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash given if Tunai */}
              {metodeBayar === 'Tunai' && (
                <div>
                  <label className="block text-[var(--redup)] font-semibold mb-1">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={nominalDiterima}
                    onChange={(e) =>
                      setNominalDiterima(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    className="w-full min-h-[44px] px-3 py-2 text-sm font-black border border-[var(--garis)] rounded-xl outline-none focus:border-[var(--utama-teks)]"
                  />
                  {typeof nominalDiterima === 'number' && (
                    <div className="mt-1 flex justify-between text-[11px] text-[var(--redup)]">
                      <span>Kembalian:</span>
                      <strong className="text-emerald-600 font-bold">
                        {formatRupiah(Math.max(0, nominalDiterima - payingOrder.total))}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="min-h-[44px] py-2.5 px-3 rounded-xl border border-[var(--garis)] text-xs font-bold text-[var(--teks)] hover:bg-[var(--latar)] active:scale-95 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingPay}
                onClick={handleProcessQuickPay}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:brightness-90 text-white text-xs font-extrabold shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isProcessingPay ? 'Memproses...' : 'Lunas & Cetak'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ACTIVE ORDER CONFIRMATION MODAL - Phone Friendly */}
      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-6 border border-[var(--garis)] text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-[var(--teks)] mb-1.5 leading-snug">
              Batalkan Pesanan #{orderToCancel.nomor_pesanan}?
            </h3>
            <p className="text-xs text-[var(--redup)] mb-5 leading-relaxed">
              Pesanan atas nama <strong className="text-[var(--teks)]">{orderToCancel.nama_pelanggan}</strong> senilai{' '}
              <strong className="text-[var(--utama-teks)] font-bold">{formatRupiah(orderToCancel.total)}</strong> akan dibatalkan dan dihapus dari daftar pesanan aktif.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setOrderToCancel(null)}
                className="min-h-[46px] py-3 px-3 rounded-2xl border border-[var(--garis)] bg-[var(--latar)] hover:bg-[var(--garis)] text-xs font-bold text-[var(--teks)] transition active:scale-95 disabled:opacity-50"
              >
                Kembali
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancelOrder}
                className="min-h-[46px] py-3 px-3 rounded-2xl bg-rose-600 hover:brightness-90 text-xs font-black text-white shadow-md shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isCancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TRANSACTION IN HISTORY CONFIRMATION MODAL */}
      {txToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-6 border border-[var(--garis)] text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-base font-black text-[var(--teks)] mb-1.5 leading-snug">
              Yakin Ingin Menghapus Transaksi Ini?
            </h3>
            
            <div className="bg-[var(--latar)] border border-[var(--garis)] rounded-2xl p-3 my-3 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[var(--redup)]">Nomor Nota:</span>
                <span className="font-mono font-bold text-[var(--teks)]">#{txToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--redup)]">Pelanggan:</span>
                <span className="font-bold text-[var(--teks)] truncate max-w-[160px]">
                  {txToDelete.nama_pelanggan || 'Pelanggan'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--redup)]">Waktu:</span>
                <span className="font-medium text-[var(--teks)]">
                  {txToDelete.waktu} · {formatDateIndo(txToDelete.tanggal)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[var(--garis)]/80">
                <span className="text-[var(--redup)] font-semibold">Total Nilai:</span>
                <span className="font-black text-[var(--utama-teks)] text-sm">
                  {formatRupiah(txToDelete.total)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--redup)] mb-5 leading-relaxed">
              Data transaksi dan catatan penjualan ini akan dihapus permanen dari riwayat pesanan.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isDeletingTx}
                onClick={() => setTxToDelete(null)}
                className="min-h-[46px] py-3 px-3 rounded-2xl border border-[var(--garis)] bg-[var(--latar)] hover:bg-[var(--garis)] text-xs font-bold text-[var(--teks)] transition active:scale-95 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isDeletingTx}
                onClick={handleConfirmDeleteTx}
                className="min-h-[46px] py-3 px-3 rounded-2xl bg-rose-600 hover:brightness-90 text-xs font-black text-white shadow-md shadow-rose-600/30 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingTx ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL FOR COMPLETED TRANSACTIONS & ACTIVE ORDERS */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaksi={selectedTx}
        items={selectedTxItems}
        onNewTransaction={() => setIsReceiptOpen(false)}
      />
    </div>
  );
};

