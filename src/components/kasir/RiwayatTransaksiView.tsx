/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Calendar,
  Receipt,
  Search,
  RefreshCw,
  Clock,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { Transaksi, DetailTransaksi } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';

type PeriodFilter = 'hari-ini' | '7-hari' | '30-hari';

export const RiwayatTransaksiView: React.FC = () => {
  const [period, setPeriod] = useState<PeriodFilter>('hari-ini');
  const [search, setSearch] = useState('');
  const [transactions, setTransactions] = useState<Transaksi[]>([]);
  const [txDetailsMap, setTxDetailsMap] = useState<Record<number, DetailTransaksi[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Selected for viewing receipt
  const [selectedTx, setSelectedTx] = useState<Transaksi | null>(null);
  const [selectedItems, setSelectedItems] = useState<DetailTransaksi[]>([]);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      let startDateStr = getFormattedDate(today);

      if (period === '7-hari') {
        const past7 = new Date(today);
        past7.setDate(today.getDate() - 7);
        startDateStr = getFormattedDate(past7);
      } else if (period === '30-hari') {
        const past30 = new Date(today);
        past30.setDate(today.getDate() - 30);
        startDateStr = getFormattedDate(past30);
      }

      // Query IndexedDB: transactions >= startDateStr
      const txList = await db.transaksi
        .where('tanggal')
        .between(startDateStr, getFormattedDate(today), true, true)
        .reverse()
        .toArray();

      setTransactions(txList);

      // Load all details for these transactions
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
      console.error('Failed to load transaction history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [period]);

  const handleOpenReceipt = (tx: Transaksi) => {
    setSelectedTx(tx);
    setSelectedItems(txDetailsMap[tx.id!] || []);
    setIsReceiptOpen(true);
  };

  // Filter by search query
  const filteredTx = transactions.filter((tx) => {
    const items = txDetailsMap[tx.id!] || [];
    const itemNames = items.map((i) => i.nama_item).join(' ').toLowerCase();
    const query = search.toLowerCase();
    return (
      String(tx.id).includes(query) ||
      (tx.metode_pembayaran || '').toLowerCase().includes(query) ||
      (tx.user_name || '').toLowerCase().includes(query) ||
      itemNames.includes(query)
    );
  });

  const totalOmzet = filteredTx.reduce((sum, tx) => sum + tx.total, 0);

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-[#FF6038]" />
            <span>Riwayat Transaksi</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Semua transaksi tersimpan offline di database IndexedDB perangkat ini.
          </p>
        </div>

        <button
          onClick={loadTransactions}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#FF6038]' : ''}`} />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Filter Chips & Search */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Period Filter Chips (FR-K10) */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(
              [
                { id: 'hari-ini', label: 'Hari Ini' },
                { id: '7-hari', label: '7 Hari Terakhir' },
                { id: '30-hari', label: '30 Hari Terakhir' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  period === p.id
                    ? 'bg-white text-[#FF6038] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID nota / menu..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-[#FF6038]"
            />
          </div>
        </div>

        {/* Quick summary stats for current filter */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div>
            Total Transaksi:{' '}
            <span className="font-extrabold text-slate-900">{filteredTx.length}</span>
          </div>
          <div>
            Total Penjualan:{' '}
            <span className="font-extrabold text-[#FF6038]">{formatRupiah(totalOmzet)}</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Memuat riwayat transaksi...</div>
      ) : filteredTx.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
          <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">Belum ada transaksi</h4>
          <p className="text-xs text-slate-400 mt-1">
            Transaksi yang dicatat di Kasir akan muncul di sini secara otomatis.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTx.map((tx) => {
            const items = txDetailsMap[tx.id!] || [];
            // Summarize max 2 items + "..." per PRD 10.5
            const itemSummary =
              items.length > 0
                ? items
                    .slice(0, 2)
                    .map((it) => `${it.jumlah}x ${it.nama_item}`)
                    .join(', ') + (items.length > 2 ? ` (+${items.length - 2} lainnya)` : '')
                : '1 item pesanan';

            return (
              <div
                key={tx.id}
                onClick={() => handleOpenReceipt(tx)}
                className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 hover:border-orange-300 hover:shadow-sm transition cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                      #{tx.id}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {tx.waktu || '12:00'} · {formatDateIndo(tx.tanggal)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-orange-50 text-[#FF6038]">
                      {tx.metode_pembayaran || 'Tunai'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium truncate">{itemSummary}</p>

                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Kasir: {tx.user_name || 'Staff'}
                  </div>
                </div>

                <div className="text-right flex items-center gap-3 shrink-0">
                  <div>
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="text-sm font-extrabold text-slate-900 group-hover:text-[#FF6038] transition">
                      {formatRupiah(tx.total)}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-50 group-hover:bg-orange-50 text-slate-400 group-hover:text-[#FF6038] flex items-center justify-center transition">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Digital Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaksi={selectedTx}
        items={selectedItems}
        onNewTransaction={() => setIsReceiptOpen(false)}
      />
    </div>
  );
};

