/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Wallet,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Info,
  Building2,
  Store,
  CheckCircle2,
  PieChart,
  Tag,
} from 'lucide-react';
import { db, getFormattedDate, ensureThirtyDaysData } from '../../db';
import type { Transaksi, DetailTransaksi, Biaya } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import type { NavTab } from '../common/Navbar';
import { useCabang } from '../../context/CabangContext';
import {
  LineChartOwner,
  type ChartDataPoint,
  type ChartPeriod,
  type MonthViewMode,
  BULAN_NAMES,
} from './LineChartOwner';

interface DashboardOwnerViewProps {
  onNavigate: (tab: NavTab) => void;
}

interface CabangComparison {
  cabang1Sales: number;
  cabang1Count: number;
  cabang2Sales: number;
  cabang2Count: number;
}

export const DashboardOwnerView: React.FC<DashboardOwnerViewProps> = ({ onNavigate }) => {
  const { selectedCabangFilter, setSelectedCabangFilter, cabangList } = useCabang();

  // Today's Live KPI States (Filtered by Selected Branch)
  const [todayPenjualan, setTodayPenjualan] = useState(0);
  const [todayTransaksiCount, setTodayTransaksiCount] = useState(0);
  const [todayLabaRugi, setTodayLabaRugi] = useState(0);
  const [todayBahanBaku, setTodayBahanBaku] = useState(0);
  const [todayOperasional, setTodayOperasional] = useState(0);

  // Cross-Branch Comparison States
  const [branchComparison, setBranchComparison] = useState<CabangComparison>({
    cabang1Sales: 0,
    cabang1Count: 0,
    cabang2Sales: 0,
    cabang2Count: 0,
  });

  // Line Chart States & Filters
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>('7-hari');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [monthViewMode, setMonthViewMode] = useState<MonthViewMode>('daily');

  // Custom date range states
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return getFormattedDate(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => getFormattedDate(new Date()));

  const [isLoadingChart, setIsLoadingChart] = useState(true);

  // 1. Load Today's Real-time KPIs & Branch Breakdown
  useEffect(() => {
    async function loadTodayKpi() {
      try {
        const todayStr = getFormattedDate(new Date());
        const rawTodayTx = await db.transaksi.where('tanggal').equals(todayStr).toArray();

        // Calculate comparison across Cabang 1 vs Cabang 2
        let c1Sales = 0;
        let c1Count = 0;
        let c2Sales = 0;
        let c2Count = 0;

        for (const t of rawTodayTx) {
          if (t.cabang === 'Cabang 2') {
            c2Sales += t.total;
            c2Count += 1;
          } else {
            // Default to Cabang 1
            c1Sales += t.total;
            c1Count += 1;
          }
        }

        setBranchComparison({
          cabang1Sales: c1Sales,
          cabang1Count: c1Count,
          cabang2Sales: c2Sales,
          cabang2Count: c2Count,
        });

        // Filter transactions for main KPI based on selectedCabangFilter
        const txList =
          selectedCabangFilter === 'Semua'
            ? rawTodayTx
            : rawTodayTx.filter((t) => (t.cabang || 'Cabang 1') === selectedCabangFilter);

        const txIds = txList.map((t) => t.id!).filter(Boolean);
        const details =
          txIds.length > 0
            ? await db.detail_transaksi.where('transaksi_id').anyOf(txIds).toArray()
            : [];

        let dayBahanCost = 0;
        for (const item of details) {
          dayBahanCost += (item.biaya_bahan_baku || 0) * item.jumlah;
        }

        const biayaList = await db.biaya.where('tanggal').equals(todayStr).toArray();
        let ops = biayaList.reduce((acc, b) => acc + b.biaya_operasional, 0) || 150000;

        // If filtering by a single branch, allocate 50% of shared operational costs
        if (selectedCabangFilter !== 'Semua') {
          ops = Math.round(ops / 2);
        }

        const totalSales = txList.reduce((acc, t) => acc + t.total, 0);

        setTodayPenjualan(totalSales);
        setTodayTransaksiCount(txList.length);
        setTodayBahanBaku(dayBahanCost);
        setTodayOperasional(ops);
        setTodayLabaRugi(totalSales - (dayBahanCost + ops));
      } catch (e) {
        console.error('Failed to load today KPI', e);
      }
    }

    loadTodayKpi();
  }, [selectedCabangFilter]);

  // 2. Load Line Chart Data based on Period, Month, or Custom Date Range, filtered by branch
  useEffect(() => {
    async function loadChartData() {
      setIsLoadingChart(true);
      try {
        await ensureThirtyDaysData();
        const today = new Date();

        let dateBuckets: { dateStr: string; label: string; isMonthlyAggregate?: boolean; monthNum?: number }[] = [];

        if (period === '7-hari') {
          // 7 days backwards
          for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = getFormattedDate(d);
            const label = d.toLocaleDateString('id-ID', {
              weekday: 'short',
              day: 'numeric',
            });
            dateBuckets.push({ dateStr, label });
          }
        } else if (period === '30-hari') {
          // 30 days backwards
          for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = getFormattedDate(d);
            const label = `${d.getDate()} ${BULAN_NAMES[d.getMonth()].slice(0, 3)}`;
            dateBuckets.push({ dateStr, label });
          }
        } else if (period === 'bulan') {
          if (monthViewMode === 'daily') {
            // Daily for the selected month
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
            const monthStr = String(selectedMonth).padStart(2, '0');
            for (let day = 1; day <= daysInMonth; day++) {
              const dayStr = String(day).padStart(2, '0');
              const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
              const label = `${day} ${BULAN_NAMES[selectedMonth - 1].slice(0, 3)}`;
              dateBuckets.push({ dateStr, label });
            }
          } else {
            // 12 Months comparison for the selected year
            for (let m = 1; m <= 12; m++) {
              const mStr = String(m).padStart(2, '0');
              dateBuckets.push({
                dateStr: `${selectedYear}-${mStr}`,
                label: BULAN_NAMES[m - 1],
                isMonthlyAggregate: true,
                monthNum: m,
              });
            }
          }
        } else if (period === 'custom') {
          // Custom date range
          let start = new Date(customStartDate || getFormattedDate(today));
          let end = new Date(customEndDate || getFormattedDate(today));
          if (start > end) {
            const tmp = start;
            start = end;
            end = tmp;
          }

          // Generate days between start and end (capped at 90 days max)
          const curr = new Date(start);
          let count = 0;
          while (curr <= end && count < 90) {
            const dateStr = getFormattedDate(curr);
            const label = `${curr.getDate()} ${BULAN_NAMES[curr.getMonth()].slice(0, 3)}`;
            dateBuckets.push({ dateStr, label });
            curr.setDate(curr.getDate() + 1);
            count++;
          }
        }

        if (dateBuckets.length === 0) {
          setChartData([]);
          return;
        }

        // Determine min and max date strings for database query
        let queryStartStr = dateBuckets[0].dateStr;
        let queryEndStr = dateBuckets[dateBuckets.length - 1].dateStr;

        if (period === 'bulan' && monthViewMode === 'yearly') {
          queryStartStr = `${selectedYear}-01-01`;
          queryEndStr = `${selectedYear}-12-31`;
        }

        // Fetch transactions for the entire date range
        const rawTxList = await db.transaksi
          .where('tanggal')
          .between(queryStartStr, queryEndStr, true, true)
          .toArray();

        // Apply Branch Filter to Chart Data!
        const txList =
          selectedCabangFilter === 'Semua'
            ? rawTxList
            : rawTxList.filter((t) => (t.cabang || 'Cabang 1') === selectedCabangFilter);

        // Fetch detail items to calculate raw material costs
        const txIds = txList.map((t) => t.id!).filter(Boolean);
        const details =
          txIds.length > 0
            ? await db.detail_transaksi.where('transaksi_id').anyOf(txIds).toArray()
            : [];

        const detailsByTxId: Record<number, DetailTransaksi[]> = {};
        for (const det of details) {
          if (!detailsByTxId[det.transaksi_id]) {
            detailsByTxId[det.transaksi_id] = [];
          }
          detailsByTxId[det.transaksi_id].push(det);
        }

        // Fetch operational costs
        const biayaList = await db.biaya
          .where('tanggal')
          .between(queryStartStr, queryEndStr, true, true)
          .toArray();

        const biayaByDate: Record<string, number> = {};
        for (const b of biayaList) {
          // If filtering by branch, divide shared operational cost by 2
          const alloc = selectedCabangFilter === 'Semua' ? b.biaya_operasional : Math.round(b.biaya_operasional / 2);
          biayaByDate[b.tanggal] = (biayaByDate[b.tanggal] || 0) + alloc;
        }

        // Aggregate into ChartDataPoint objects
        const computedData: ChartDataPoint[] = dateBuckets.map((bucket) => {
          let dayTx: Transaksi[] = [];
          let dayOperasional = 0;

          if (bucket.isMonthlyAggregate && bucket.monthNum) {
            // Aggregate all transactions in this month
            const monthPrefix = `${selectedYear}-${String(bucket.monthNum).padStart(2, '0')}`;
            dayTx = txList.filter((t) => t.tanggal.startsWith(monthPrefix));
            // Aggregate operational costs in this month
            for (const b of biayaList) {
              if (b.tanggal.startsWith(monthPrefix)) {
                const alloc = selectedCabangFilter === 'Semua' ? b.biaya_operasional : Math.round(b.biaya_operasional / 2);
                dayOperasional += alloc;
              }
            }
            if (dayOperasional === 0 && dayTx.length > 0) {
              dayOperasional = (selectedCabangFilter === 'Semua' ? 150000 : 75000) * 30;
            }
          } else {
            // Daily bucket
            dayTx = txList.filter((t) => t.tanggal === bucket.dateStr);
            dayOperasional = biayaByDate[bucket.dateStr] ?? (dayTx.length > 0 ? (selectedCabangFilter === 'Semua' ? 150000 : 75000) : 0);
          }

          const dayPenjualan = dayTx.reduce((sum, t) => sum + t.total, 0);

          let dayBahanCost = 0;
          for (const tx of dayTx) {
            const txItems = detailsByTxId[tx.id!] || [];
            for (const item of txItems) {
              dayBahanCost += (item.biaya_bahan_baku || 0) * item.jumlah;
            }
          }

          const dayLaba = dayPenjualan - (dayBahanCost + dayOperasional);

          return {
            tanggal: bucket.dateStr,
            label: bucket.label,
            penjualan: dayPenjualan,
            biayaBahan: dayBahanCost,
            biayaOperasional: dayOperasional,
            labaBersih: dayLaba,
            totalTransaksi: dayTx.length,
          };
        });

        setChartData(computedData);
      } catch (err) {
        console.error('Failed to load line chart data:', err);
      } finally {
        setIsLoadingChart(false);
      }
    }

    loadChartData();
  }, [period, selectedMonth, selectedYear, monthViewMode, customStartDate, customEndDate, selectedCabangFilter]);

  const totalCombinedToday = branchComparison.cabang1Sales + branchComparison.cabang2Sales;
  const c1Percent = totalCombinedToday > 0 ? Math.round((branchComparison.cabang1Sales / totalCombinedToday) * 100) : 50;
  const c2Percent = totalCombinedToday > 0 ? 100 - c1Percent : 50;

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Dashboard Top Header & Branch Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Dashboard Pemilik Usaha
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Laporan penjualan, grafik keuangan, dan komparasi performa antar cabang warung.
          </p>
        </div>

        {/* Multi-Branch Filter Tabs Sederhana */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg border border-gray-300 self-start md:self-auto text-xs">
          <button
            type="button"
            onClick={() => setSelectedCabangFilter('Semua')}
            className={`px-3 py-1.5 rounded font-medium transition cursor-pointer ${
              selectedCabangFilter === 'Semua'
                ? 'bg-orange-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Semua Cabang
          </button>

          {cabangList.map((cabang) => {
            const isSelected = selectedCabangFilter === cabang;
            return (
              <button
                key={cabang}
                type="button"
                onClick={() => setSelectedCabangFilter(cabang)}
                className={`px-3 py-1.5 rounded font-medium transition cursor-pointer ${
                  isSelected
                    ? 'bg-orange-600 text-white font-semibold shadow-xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                {cabang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Perbandingan Penjualan Antar Cabang (Tampilan Tabel Mahasiswa / Sistem Informasi) */}
      <div className="mb-5 bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm sm:text-base text-gray-800 flex items-center gap-2">
              <Store className="w-4 h-4 text-orange-600" />
              <span>Tabel Perbandingan Penjualan Antar Cabang (Hari Ini)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Rekap perolehan omzet dan volume transaksi harian per kasir cabang
            </p>
          </div>

          <div className="flex items-center gap-2 text-left sm:text-right">
            <div>
              <span className="text-[11px] text-gray-500 block uppercase font-medium">Total Omzet Gabungan</span>
              <span className="text-base font-bold text-gray-900">
                {formatRupiah(totalCombinedToday)}
              </span>
            </div>
          </div>
        </div>

        {/* Tabel Komparasi Cabang */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead className="bg-gray-100/90 text-gray-700 text-xs font-semibold uppercase tracking-wider border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">Nama Cabang</th>
                <th className="px-4 py-3">Kasir Bertugas</th>
                <th className="px-4 py-3 text-center">Jumlah Transaksi</th>
                <th className="px-4 py-3 text-right">Total Omzet</th>
                <th className="px-4 py-3 text-center">Rata-rata/Nota</th>
                <th className="px-4 py-3">Porsi Penjualan</th>
                <th className="px-4 py-3 text-center">Aksi Filter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-700">
              {/* Row Cabang 1 */}
              <tr className={`hover:bg-gray-50/80 transition ${selectedCabangFilter === 'Cabang 1' ? 'bg-orange-50/60 font-medium' : ''}`}>
                <td className="px-4 py-3.5 font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-600 inline-block"></span>
                  Cabang 1
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-gray-900 font-medium">Siti</span>
                  <span className="text-xs text-gray-400 block font-normal">user: kasir1</span>
                </td>
                <td className="px-4 py-3.5 text-center font-medium">
                  {branchComparison.cabang1Count} Transaksi
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                  {formatRupiah(branchComparison.cabang1Sales)}
                </td>
                <td className="px-4 py-3.5 text-center text-gray-600">
                  {formatRupiah(branchComparison.cabang1Count > 0 ? Math.round(branchComparison.cabang1Sales / branchComparison.cabang1Count) : 0)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded h-2 overflow-hidden">
                      <div style={{ width: `${c1Percent}%` }} className="bg-orange-600 h-full"></div>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{c1Percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedCabangFilter(selectedCabangFilter === 'Cabang 1' ? 'Semua' : 'Cabang 1')}
                    className={`px-3 py-1 text-xs rounded border cursor-pointer font-medium transition ${
                      selectedCabangFilter === 'Cabang 1'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {selectedCabangFilter === 'Cabang 1' ? 'Sedang Dipilih ✓' : 'Filter Cabang'}
                  </button>
                </td>
              </tr>

              {/* Row Cabang 2 */}
              <tr className={`hover:bg-gray-50/80 transition ${selectedCabangFilter === 'Cabang 2' ? 'bg-orange-50/60 font-medium' : ''}`}>
                <td className="px-4 py-3.5 font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600 inline-block"></span>
                  Cabang 2
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-gray-900 font-medium">Rian</span>
                  <span className="text-xs text-gray-400 block font-normal">user: kasir2</span>
                </td>
                <td className="px-4 py-3.5 text-center font-medium">
                  {branchComparison.cabang2Count} Transaksi
                </td>
                <td className="px-4 py-3.5 text-right font-bold text-gray-900">
                  {formatRupiah(branchComparison.cabang2Sales)}
                </td>
                <td className="px-4 py-3.5 text-center text-gray-600">
                  {formatRupiah(branchComparison.cabang2Count > 0 ? Math.round(branchComparison.cabang2Sales / branchComparison.cabang2Count) : 0)}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded h-2 overflow-hidden">
                      <div style={{ width: `${c2Percent}%` }} className="bg-slate-600 h-full"></div>
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-10 text-right">{c2Percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <button
                    type="button"
                    onClick={() => setSelectedCabangFilter(selectedCabangFilter === 'Cabang 2' ? 'Semua' : 'Cabang 2')}
                    className={`px-3 py-1 text-xs rounded border cursor-pointer font-medium transition ${
                      selectedCabangFilter === 'Cabang 2'
                        ? 'bg-orange-600 text-white border-orange-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {selectedCabangFilter === 'Cabang 2' ? 'Sedang Dipilih ✓' : 'Filter Cabang'}
                  </button>
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold text-gray-900">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Total Gabungan Semua Cabang
                </td>
                <td className="px-4 py-3 text-center">
                  {branchComparison.cabang1Count + branchComparison.cabang2Count} Transaksi
                </td>
                <td className="px-4 py-3 text-right text-orange-700 font-bold">
                  {formatRupiah(totalCombinedToday)}
                </td>
                <td className="px-4 py-3 text-center text-gray-700">
                  {formatRupiah(
                    branchComparison.cabang1Count + branchComparison.cabang2Count > 0
                      ? Math.round(totalCombinedToday / (branchComparison.cabang1Count + branchComparison.cabang2Count))
                      : 0
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 font-normal">
                  100% (Akumulasi)
                </td>
                <td className="px-4 py-3 text-center">
                  {selectedCabangFilter !== 'Semua' ? (
                    <button
                      type="button"
                      onClick={() => setSelectedCabangFilter('Semua')}
                      className="px-2.5 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer font-medium"
                    >
                      Tampilkan Semua
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 font-normal">Semua Terpilih</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Visual Rasio Sederhana */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
            <span className="font-semibold text-gray-700">Grafik Rasio Kontribusi Penjualan:</span>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-orange-600 rounded-sm inline-block"></span>
                <span>Cabang 1: {c1Percent}% ({formatRupiah(branchComparison.cabang1Sales)})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-600 rounded-sm inline-block"></span>
                <span>Cabang 2: {c2Percent}% ({formatRupiah(branchComparison.cabang2Sales)})</span>
              </span>
            </div>
          </div>
          <div className="h-3 w-full bg-gray-200 rounded flex overflow-hidden">
            <div
              style={{ width: `${c1Percent}%` }}
              className="bg-orange-600 h-full transition-all duration-300"
              title={`Cabang 1: ${c1Percent}%`}
            />
            <div
              style={{ width: `${c2Percent}%` }}
              className="bg-slate-600 h-full transition-all duration-300"
              title={`Cabang 2: ${c2Percent}%`}
            />
          </div>
        </div>
      </div>

      {/* Active Filter Notice Sederhana */}
      <div className="flex items-center justify-between mb-4 bg-white px-3.5 py-2.5 rounded-lg border border-gray-200 text-xs">
        <div className="flex items-center gap-2 text-gray-700">
          <span className="font-medium text-gray-500">Filter Aktif:</span>
          <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700 font-semibold border border-orange-200">
            {selectedCabangFilter === 'Semua' ? 'Semua Cabang (Data Gabungan)' : `Data ${selectedCabangFilter}`}
          </span>
        </div>

        {selectedCabangFilter !== 'Semua' && (
          <button
            type="button"
            onClick={() => setSelectedCabangFilter('Semua')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
          >
            ← Tampilkan Semua Cabang
          </button>
        )}
      </div>

      {/* 3 KPI Cards - Sederhana & Jelas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        {/* Card 1: Penjualan Hari Ini */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              Total Penjualan Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {formatRupiah(todayPenjualan)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{todayTransaksiCount} transaksi</span>
            <span>({selectedCabangFilter === 'Semua' ? 'Semua Cabang' : selectedCabangFilter})</span>
          </div>
        </div>

        {/* Card 2: Total Transaksi */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              Total Transaksi Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            {todayTransaksiCount} <span className="text-base font-medium text-gray-500">Pesanan</span>
          </div>
          <div className="mt-1.5 text-xs text-gray-500">
            Rata-rata:{' '}
            <span className="font-semibold text-gray-700">
              {formatRupiah(todayTransaksiCount > 0 ? todayPenjualan / todayTransaksiCount : 0)}
            </span>
          </div>
        </div>

        {/* Card 3: Laba / Rugi Hari Ini */}
        <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">
              Laba / Rugi Bersih Hari Ini
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                todayLabaRugi >= 0
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {todayLabaRugi >= 0 ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-bold tracking-tight ${
              todayLabaRugi >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatRupiah(todayLabaRugi)}
          </div>
          <div className="mt-1.5 text-[11px] text-gray-500 flex items-center gap-1">
            <Info className="w-3 h-3 text-gray-400 shrink-0" />
            <span>Omzet - (Biaya Bahan + Operasional)</span>
          </div>
        </div>
      </div>

      {/* Interactive Line Chart with Rentang Tanggal & Pilihan Bulan */}
      <LineChartOwner
        chartData={chartData}
        period={period}
        onPeriodChange={setPeriod}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        monthViewMode={monthViewMode}
        onMonthViewModeChange={setMonthViewMode}
        customStartDate={customStartDate}
        onCustomStartDateChange={setCustomStartDate}
        customEndDate={customEndDate}
        onCustomEndDateChange={setCustomEndDate}
        isLoading={isLoadingChart}
      />

      {/* Quick Navigation Cards to Owner Features */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => onNavigate('terlaris')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-400 hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-orange-50 text-orange-700 flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition">
            Menu Terlaris
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Top 10 menu terpopuler</p>
        </button>

        <button
          onClick={() => onNavigate('biaya')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-400 hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition">
            Pengaturan Biaya
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Bahan baku & operasional</p>
        </button>

        <button
          onClick={() => onNavigate('ekspor')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-400 hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center mb-2">
            <Receipt className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition">
            Ekspor CSV
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Download laporan transaksi</p>
        </button>

        <button
          onClick={() => onNavigate('promo')}
          className="p-4 rounded-xl bg-white border border-gray-200 hover:border-orange-400 hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
            <Tag className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-gray-900 group-hover:text-orange-600 transition">
            Kelola Promo
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Diskon & voucher toko</p>
        </button>
      </div>
    </div>
  );
};

