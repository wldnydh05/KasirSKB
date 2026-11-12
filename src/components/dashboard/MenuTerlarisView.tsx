/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, Award, UtensilsCrossed, ArrowUpRight, Store } from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { DetailTransaksi } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useCabang } from '../../context/CabangContext';

interface MenuRankingItem {
  nama: string;
  terjual: number;
  pendapatan: number;
}

export const MenuTerlarisView: React.FC = () => {
  const [period, setPeriod] = useState<'7' | '30'>('7');
  const { selectedCabangFilter, setSelectedCabangFilter, cabangList } = useCabang();
  const [ranking, setRanking] = useState<MenuRankingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRanking() {
      setIsLoading(true);
      try {
        const today = new Date();
        const daysBack = period === '7' ? 7 : 30;
        const pastDate = new Date(today);
        pastDate.setDate(today.getDate() - daysBack);

        const startDateStr = getFormattedDate(pastDate);
        const endDateStr = getFormattedDate(today);

        // 1. Get transactions in this date range
        let txList = await db.transaksi
          .where('tanggal')
          .between(startDateStr, endDateStr, true, true)
          .toArray();

        // Filter by branch
        if (selectedCabangFilter !== 'Semua') {
          txList = txList.filter((tx) => (tx.cabang || 'Cabang 1') === selectedCabangFilter);
        }

        const txIds = txList.map((t) => t.id!).filter(Boolean);

        if (txIds.length === 0) {
          setRanking([]);
          return;
        }

        // 2. Get all details
        const details = await db.detail_transaksi
          .where('transaksi_id')
          .anyOf(txIds)
          .toArray();

        // 3. Aggregate by nama_item
        const aggregateMap: Record<string, { terjual: number; pendapatan: number }> = {};
        for (const d of details) {
          if (!aggregateMap[d.nama_item]) {
            aggregateMap[d.nama_item] = { terjual: 0, pendapatan: 0 };
          }
          aggregateMap[d.nama_item].terjual += d.jumlah;
          aggregateMap[d.nama_item].pendapatan += d.subtotal;
        }

        // 4. Sort by terjual descending & take top 10 (FR-D03, AC-09)
        const sorted = Object.entries(aggregateMap)
          .map(([nama, data]) => ({
            nama,
            terjual: data.terjual,
            pendapatan: data.pendapatan,
          }))
          .sort((a, b) => b.terjual - a.terjual)
          .slice(0, 10);

        setRanking(sorted);
      } catch (err) {
        console.error('Failed to load best sellers ranking:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRanking();
  }, [period, selectedCabangFilter]);

  const maxTerjual = ranking.length > 0 ? ranking[0].terjual : 1;

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-[#FF6038]" />
            <span>Ranking Menu Terlaris</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar 10 menu paling diminati pelanggan untuk evaluasi stok dan promo.
          </p>
        </div>

        {/* Filters: Cabang & Periode */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Branch filter */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl shadow-2xs">
            <button
              onClick={() => setSelectedCabangFilter('Semua')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCabangFilter === 'Semua'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Cabang
            </button>
            {cabangList.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCabangFilter(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedCabangFilter === c
                    ? 'bg-[#FF6038] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Filter 7 / 30 Hari */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl shadow-2xs">
            <button
              onClick={() => setPeriod('7')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                period === '7'
                  ? 'bg-[#FF6038] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              onClick={() => setPeriod('30')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                period === '30'
                  ? 'bg-[#FF6038] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Hari
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-xs text-slate-400">Menghitung ranking menu...</div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
          <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-slate-700">Belum ada data penjualan</h4>
          <p className="text-xs text-slate-400 mt-1">
            Lakukan transaksi di Kasir untuk melihat peringkat menu terpopuler.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-14 text-center">No</th>
                  <th className="py-3 px-4">Nama Menu</th>
                  <th className="py-3 px-4 text-center">Terjual</th>
                  <th className="py-3 px-4 text-right">Total Pendapatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ranking.map((item, index) => {
                  const rank = index + 1;
                  const percentWidth = Math.round((item.terjual / maxTerjual) * 100);

                  return (
                    <tr key={index} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 text-center">
                        {rank === 1 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-extrabold text-xs">
                            🥇 1
                          </span>
                        ) : rank === 2 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-extrabold text-xs">
                            🥈 2
                          </span>
                        ) : rank === 3 ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-900 font-extrabold text-xs">
                            🥉 3
                          </span>
                        ) : (
                          <span className="font-bold text-slate-400">#{rank}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm mb-1">{item.nama}</div>
                        {/* Relative visual popularity bar */}
                        <div className="w-full max-w-[200px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            style={{ width: `${percentWidth}%` }}
                            className="h-full bg-gradient-to-r from-orange-400 to-[#FF6038] rounded-full"
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-orange-50 font-extrabold text-slate-900 text-xs">
                          {item.terjual} porsi
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-slate-900 text-sm">
                        {formatRupiah(item.pendapatan)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
