/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useCabang } from './CabangContext';
import {
  transaksiService,
  detailTransaksiService,
  pesananAktifService,
  getFormattedDate,
  getFormattedTime,
} from '../lib/supabaseService';
import type { CartItem, Menu, Promo, Transaksi, DetailTransaksi, PesananAktif } from '../types';

interface ActiveOrderInfo {
  id: number;
  nomor_pesanan: string;
  nama_pelanggan: string;
  tipe_pesanan?: 'Makan Di Tempat' | 'Bungkus';
  cabang?: string;
}

export interface ProcessCheckoutPayload {
  namaPelanggan: string;
  tipePesanan?: 'Makan Di Tempat' | 'Bungkus';
  nomorMeja?: string;
  catatan?: string;
  metodePembayaran: 'Tunai' | 'QRIS' | 'Transfer';
  nominalBayar?: number;
}

export interface ProcessCheckoutResult {
  success: boolean;
  transaksi?: Transaksi;
  orderId?: number;
  receiptItems: DetailTransaksi[];
}

interface CartContextType {
  items: CartItem[];
  addItem: (menu: Menu, customHarga?: number) => void;
  updateQuantity: (index: number, delta: number) => void;
  removeItem: (index: number) => void;
  clearCart: () => void;
  appliedPromo: Promo | null;
  setAppliedPromo: (promo: Promo | null) => void;
  subtotal: number;
  discountAmount: number;
  total: number;
  totalItemsCount: number;
  activeOrderInfo: ActiveOrderInfo | null;
  processCheckout: (payload: ProcessCheckoutPayload) => Promise<ProcessCheckoutResult>;
  saveTransaction: (
    metodePembayaran: string,
    nominalBayar?: number
  ) => Promise<{ success: boolean; transaksiId?: number; data?: Transaksi }>;
  saveActiveOrder: (
    namaPelanggan: string,
    nomorMeja?: string,
    catatan?: string,
    tipePesanan?: 'Makan Di Tempat' | 'Bungkus'
  ) => Promise<{ success: boolean; id?: number }>;
  loadActiveOrderToCart: (order: PesananAktif) => void;
  cancelActiveOrderContext: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'bukupos_cart_items';
const ACTIVE_ORDER_STORAGE_KEY = 'bukupos_active_order_info';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { activeCashierCabang, cabangList } = useCabang();
  // Fallback terakhir memakai daftar cabang yang berlaku — jangan hardcode nama cabang.
  const currentCabang = user?.cabang || activeCashierCabang || cabangList[0] || '';

  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeOrderInfo, setActiveOrderInfo] = useState<ActiveOrderInfo | null>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [appliedPromo, setAppliedPromo] = useState<Promo | null>(null);

  // Sync cart to local storage temporer
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  useEffect(() => {
    try {
      if (activeOrderInfo) {
        localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, JSON.stringify(activeOrderInfo));
      } else {
        localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to sync active order info', e);
    }
  }, [activeOrderInfo]);

  const addItem = (menu: Menu, customHarga?: number) => {
    // Harga custom = kasir ketik sendiri (mis. Bebek Rp13.000–20.000) → item ditandai manual
    const isManualPrice = typeof customHarga === 'number' && customHarga > 0;
    const harga = isManualPrice ? customHarga : menu.harga;
    
    // Ambil HPP per cabang dari menu, fallback ke biaya_bahan_baku lama
    const perCabang = (menu.biaya_per_cabang as Record<string, number>) || {};
    const withDefaults: Record<string, number> = {};
    // Gunakan cabang dari activeOrderInfo atau currentCabang
    const targetCabang = activeOrderInfo?.cabang || currentCabang;
    const hppDefault = perCabang[targetCabang] ?? menu.biaya_bahan_baku ?? 0;

    setItems((prev) => {
      if (!isManualPrice) {
        const existingIndex = prev.findIndex((item) => !item.is_manual && item.menu_id === menu.id);
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
      // Item harga custom tidak digestung — setiap ketikan harga = baris baru
      return [
        ...prev,
        {
          menu_id: menu.id,
          nama: menu.nama,
          harga,
          biaya_bahan_baku: hppDefault,
          biaya_per_cabang: perCabang,
          jumlah: 1,
          subtotal: harga,
          gambar_url: menu.gambar_url,
          is_manual: isManualPrice,
        },
      ];
    });
  };

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

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setItems([]);
    setAppliedPromo(null);
    setActiveOrderInfo(null);
    localStorage.removeItem(CART_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
  };

  const cancelActiveOrderContext = () => {
    setActiveOrderInfo(null);
    localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
  };

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  let discountAmount = 0;
  if (appliedPromo && subtotal > 0) {
    if (appliedPromo.tipe === 'persen') {
      discountAmount = Math.round((subtotal * appliedPromo.nilai) / 100);
    } else {
      discountAmount = Math.min(subtotal, appliedPromo.nilai);
    }
  }

  const total = Math.max(0, subtotal - discountAmount);
  const totalItemsCount = items.reduce((sum, item) => sum + item.jumlah, 0);

  // Save as Pending / Active Order (Belum Selesai Transaksinya)
  const saveActiveOrder = async (
    namaPelanggan: string,
    nomorMeja?: string,
    catatan?: string,
    tipePesanan?: 'Makan Di Tempat' | 'Bungkus'
  ): Promise<{ success: boolean; id?: number }> => {
    if (items.length === 0) return { success: false };

    try {
      const todayDate = new Date();
      const tanggal = getFormattedDate(todayDate);
      const waktu = getFormattedTime(todayDate);
      const nowIso = todayDate.toISOString();

      const orderNumber = await pesananAktifService.getNextOrderNumber();
      const resolvedTipe = tipePesanan || (nomorMeja ? 'Makan Di Tempat' : 'Bungkus');

      let orderId: number;
      if (activeOrderInfo?.id) {
        // Updating existing active order
        orderId = activeOrderInfo.id;
        await pesananAktifService.update(orderId, {
          nama_pelanggan: namaPelanggan || activeOrderInfo.nama_pelanggan,
          tipe_pesanan: resolvedTipe,
          nomor_meja: resolvedTipe === 'Makan Di Tempat' ? nomorMeja : undefined,
          catatan,
          total,
          items,
        });
      } else {
        // Creating new active order
        orderId = (await pesananAktifService.create({
          nomor_pesanan: orderNumber,
          cabang: activeOrderInfo?.cabang || currentCabang,
          nama_pelanggan: namaPelanggan || (resolvedTipe === 'Bungkus' ? 'Pelanggan Bungkus' : 'Pelanggan Meja'),
          tipe_pesanan: resolvedTipe,
          nomor_meja: resolvedTipe === 'Makan Di Tempat' ? nomorMeja : undefined,
          catatan,
          tanggal,
          waktu,
          total,
          items,
          status: 'menunggu_pembayaran',
          user_id: user?.id || 1,
          user_name: user?.username || 'Kasir',
          created_at: nowIso,
        })).id!;
      }

      clearCart();
      return { success: true, id: orderId };
    } catch (err) {
      console.error('Failed to save active order:', err);
      return { success: false };
    }
  };

  // Load an active order into the cart so it can be paid or edited
  const loadActiveOrderToCart = (order: PesananAktif) => {
    setItems(order.items || []);
    if (order.id) {
      setActiveOrderInfo({
        id: order.id,
        nomor_pesanan: order.nomor_pesanan,
        nama_pelanggan: order.nama_pelanggan,
        tipe_pesanan: order.tipe_pesanan,
        cabang: order.cabang,
      });
    }
  };

  // Complete Payment / Save Transaction (History Selesai / Lunas)
  const saveTransaction = async (
    metodePembayaran: string = 'Tunai',
    nominalBayar?: number
  ): Promise<{ success: boolean; transaksiId?: number; data?: Transaksi }> => {
    if (items.length === 0) {
      return { success: false };
    }

    const todayDate = new Date();
    const tanggal = getFormattedDate(todayDate);
    const waktu = getFormattedTime(todayDate);
    const nowIso = todayDate.toISOString();

    const actualNominal = nominalBayar && nominalBayar >= total ? nominalBayar : total;
    const kembalian = actualNominal - total;

    try {
      const txCabang = activeOrderInfo?.cabang || currentCabang;
      const createdTx = await transaksiService.create({
        tanggal,
        waktu,
        total,
        user_id: user?.id || 1,
        user_name: user?.username || 'Kasir',
        cabang: txCabang,
        metode_pembayaran: metodePembayaran,
        nominal_bayar: actualNominal,
        kembalian,
        created_at: nowIso,
      });

      const createdTxId = createdTx.id!;

      const details: Omit<DetailTransaksi, 'id'>[] = items.map((item) => ({
        transaksi_id: createdTxId,
        menu_id: item.menu_id ?? null,
        nama_item: item.nama,
        harga_satuan: item.harga,
        biaya_bahan_baku: item.biaya_bahan_baku || 0,
        jumlah: item.jumlah,
        subtotal: item.subtotal,
        is_manual: Boolean(item.is_manual),
      }));

      await detailTransaksiService.bulkCreate(details);

      // If this transaction was fulfilling an active order, remove it from pesanan_aktif
      if (activeOrderInfo?.id) {
        await pesananAktifService.softDelete(activeOrderInfo.id);
      }

      // Clear cart on successful save
      clearCart();

      return {
        success: true,
        transaksiId: createdTxId,
        data: createdTx,
      };
    } catch (err) {
      console.error('Failed to save transaction:', err);
      return { success: false };
    }
  };

  // Unified Checkout: saves order into pesanan_aktif, saves transaction if paid, and returns receipt data
  const processCheckout = async (payload: ProcessCheckoutPayload): Promise<ProcessCheckoutResult> => {
    if (items.length === 0) {
      return { success: false, receiptItems: [] };
    }

    const todayDate = new Date();
    const tanggal = getFormattedDate(todayDate);
    const waktu = getFormattedTime(todayDate);
    const nowIso = todayDate.toISOString();

    const orderNumber = await pesananAktifService.getNextOrderNumber();
    const custName = payload.namaPelanggan.trim() || 'Pelanggan Umum';

    const actualNominal =
      payload.nominalBayar && payload.nominalBayar >= total ? payload.nominalBayar : total;
    const kembalian = payload.metodePembayaran === 'Tunai' ? Math.max(0, actualNominal - total) : 0;

    const detailSnapshot: DetailTransaksi[] = items.map((it) => ({
      transaksi_id: 0,
      nama_item: it.nama,
      harga_satuan: it.harga,
      jumlah: it.jumlah,
      subtotal: it.subtotal,
      is_manual: Boolean(it.is_manual),
    }));

    try {
      let createdTxId: number | undefined;
      let createdTx: Transaksi | undefined;
      let savedOrderId: number;

      // Paid immediately (Tunai / QRIS / Transfer)
      // 1. Record transaction in transaksi & detail_transaksi
      const txCabang = activeOrderInfo?.cabang || currentCabang;
      const resolvedTipe = payload.tipePesanan || (payload.nomorMeja ? 'Makan Di Tempat' : 'Bungkus');
      const resolvedMeja = resolvedTipe === 'Makan Di Tempat' ? payload.nomorMeja?.trim() || undefined : undefined;

      const tx = await transaksiService.create({
        tanggal,
        waktu,
        total,
        user_id: user?.id || 1,
        user_name: user?.username || 'Kasir',
        cabang: txCabang,
        metode_pembayaran: payload.metodePembayaran,
        nominal_bayar: actualNominal,
        kembalian,
        nama_pelanggan: custName,
        tipe_pesanan: resolvedTipe,
        nomor_meja: resolvedMeja,
        catatan: payload.catatan?.trim(),
        created_at: nowIso,
      });

      createdTxId = tx.id!;
      createdTx = tx;

      const details: Omit<DetailTransaksi, 'id'>[] = items.map((item) => ({
        transaksi_id: createdTxId,
        menu_id: item.menu_id ?? null,
        nama_item: item.nama,
        harga_satuan: item.harga,
        biaya_bahan_baku: item.biaya_bahan_baku || 0,
        biaya_per_cabang: item.biaya_per_cabang || {},
        jumlah: item.jumlah,
        subtotal: item.subtotal,
        is_manual: Boolean(item.is_manual),
      }));

      await detailTransaksiService.bulkCreate(details);

      // 2. Automatically put order into pesanan_aktif (status: diproses)
      // so staff/dapur can see the order in the Pesanan section
      if (activeOrderInfo?.id) {
        savedOrderId = activeOrderInfo.id;
        await pesananAktifService.update(savedOrderId, {
          nama_pelanggan: custName,
          tipe_pesanan: resolvedTipe,
          nomor_meja: resolvedMeja,
          catatan: payload.catatan?.trim() || undefined,
          total,
          items: [...items],
          status: 'diproses',
          metode_pembayaran: payload.metodePembayaran,
          nominal_bayar: actualNominal,
          kembalian,
          transaksi_id: createdTxId,
        });
      } else {
        const newOrder = await pesananAktifService.create({
          nomor_pesanan: orderNumber,
          cabang: txCabang,
          nama_pelanggan: custName,
          tipe_pesanan: resolvedTipe,
          nomor_meja: resolvedMeja,
          catatan: payload.catatan?.trim() || undefined,
          tanggal,
          waktu,
          total,
          items: [...items],
          status: 'diproses',
          metode_pembayaran: payload.metodePembayaran,
          nominal_bayar: actualNominal,
          kembalian,
          transaksi_id: createdTxId,
          user_id: user?.id || 1,
          user_name: user?.username || 'Kasir',
          created_at: nowIso,
        });
        savedOrderId = newOrder.id!;
      }

      // Update detailSnapshot with generated ID
      const finalItems = detailSnapshot.map((d) => ({
        ...d,
        transaksi_id: createdTxId || savedOrderId,
      }));

      // Clear active order link and cart
      setActiveOrderInfo(null);
      clearCart();

      return {
        success: true,
        transaksi: createdTx,
        orderId: savedOrderId,
        receiptItems: finalItems,
      };
    } catch (err) {
      console.error('Failed to process checkout:', err);
      return { success: false, receiptItems: [] };
    }
  };

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
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
        saveTransaction,
        saveActiveOrder,
        loadActiveOrderToCart,
        cancelActiveOrderContext,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};