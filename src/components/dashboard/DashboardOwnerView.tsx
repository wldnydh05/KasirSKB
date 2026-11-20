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
import {
  transaksiService,
  detailTransaksiService,
  biayaService,
  userService,
  menuService,
  getFormattedDate,
} from '../../lib/supabaseService';
import type { Transaksi, DetailTransaksi, Biaya, User } from '../../types';
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

  // Nama cabang BERLAKU dari daftar cabang — jangan hardcode 'Cabang 1'/'Cabang 2'
  const cabang1Name = cabangList[0] || 'Cabang 1';
  const cabang2Name = cabangList[1] || 'Cabang 2';

  // Username kasir yang bertugas di suatu cabang (kolom "Petugas")
  const staffOf = (cabang: string) => {
    const list = staffList.filter((s) => (s.cabang || '').toLowerCase() === cabang.toLowerCase());
    return list.length > 0 ? list.map((s) => s.username).join(', ') : '—';
  };

  // ALL useState hooks MUST be called unconditionally at the top (Rules of Hooks)
  const [isLoadingKpi, setIsLoadingKpi] = useState(true);
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

  // Daftar kasir (untuk menampilkan petugas tiap cabang — bukan nama hardcode)
  const [staffList, setStaffList] = useState<User[]>([]);

  // Line Chart States & Filters
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState<ChartPeriod>('7-hari');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedMonthEnd, setSelectedMonthEnd] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedYearEnd, setSelectedYearEnd] = useState<number>(() => new Date().getFullYear());
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
      setIsLoadingKpi(true);
      try {
        const todayStr = getFormattedDate(new Date());
        const rawTodayTx = await transaksiService.getByDateRange(todayStr, todayStr);

        // Muat daftar kasir aktif (kolom Petugas per cabang)
        const staff = await userService.getByRole('staff');
        setStaffList(staff);

        // Calculate comparison across cabang pertama vs cabang kedua (daftar berlaku)
        let c1Sales = 0;
        let c1Count = 0;
        let c2Sales = 0;
        let c2Count = 0;

        for (const t of rawTodayTx) {
          if (t.cabang && t.cabang.toLowerCase() === cabang2Name.toLowerCase()) {
            c2Sales += t.total;
            c2Count += 1;
          } else {
            // Default ke cabang pertama
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
            : rawTodayTx.filter((t) => (t.cabang || cabang1Name) === selectedCabangFilter);

        // If no transactions today (or filtered out by branch), show zero KPIs instead of negative profit
        if (rawTodayTx.length === 0 || txList.length === 0) {
          setTodayPenjualan(0);
          setTodayTransaksiCount(0);
          setTodayBahanBaku(0);
          setTodayOperasional(0);
          setTodayLabaRugi(0);
          return;
        }

        const txIds = txList.map((t) => t.id!).filter(Boolean);
        const details =
          txIds.length > 0
            ? await Promise.all(txIds.map((id) => detailTransaksiService.getByTransaksiId(id))).then(
                (arr) => arr.flat()
              )
            : [];

        // Fetch all menus for HPP per cabang lookup
        const allMenus = await menuService.getAll();
        const menuHppMap = new Map<number, Record<string, number>>();
        for (const m of allMenus) {
          if (m.id) {
            const perCabang = (m.biaya_per_cabang as Record<string, number>) || {};
            // Fallback ke biaya_bahan_baku lama
            const withDefaults: Record<string, number> = {};
            cabangList.forEach((c) => {
              withDefaults[c] = perCabang[c] ?? m.biaya_bahan_baku ?? 0;
            });
            menuHppMap.set(m.id, withDefaults);
          }
        }

        let dayBahanCost = 0;
        for (const item of details) {
          // Get HPP per cabang dari transaksi's cabang
          const tx = txList.find((t) => t.id === item.transaksi_id);
          const txCabang = tx?.cabang || cabangList[0] || '';
          const menuHpp = item.menu_id ? menuHppMap.get(item.menu_id) : null;
          const hpp = menuHpp?.[txCabang] ?? menuHpp?.[cabangList[0] || ''] ?? item.biaya_bahan_baku ?? 0;
          dayBahanCost += (hpp || 0) * item.jumlah;
        }

        const singleBiaya = selectedCabangFilter !== 'Semua'
            ? await biayaService.getByDateAndCabang(todayStr, selectedCabangFilter)
            : null;
        const biayaList = selectedCabangFilter === 'Semua'
            ? await biayaService.getByDateRange(todayStr, todayStr)
            : singleBiaya ? [singleBiaya] : [];
        let ops = biayaList.reduce((sum, b) => sum + (b.biaya_operasional || 0), 0);

        // If no operational cost record exists, use 0 instead of default 150000
        // This ensures profit is 0 when no costs are set
        if (ops === 0) ops = 0;

        const totalSales = txList.reduce((acc, t) => acc + t.total, 0);

        setTodayPenjualan(totalSales);
        setTodayTransaksiCount(txList.length);
        setTodayBahanBaku(dayBahanCost);
        setTodayOperasional(ops);
        setTodayLabaRugi(totalSales - (dayBahanCost + ops));
      } catch (e) {
        console.error('Failed to load today KPI', e);
      } finally {
        setIsLoadingKpi(false);
      }
    }

    loadTodayKpi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCabangFilter, cabangList]);

  // 2. Load Line Chart Data based on Period, Month, or Custom Date Range, filtered by branch
  useEffect(() => {
    async function loadChartData() {
      setIsLoadingChart(true);
      try {
        const today = new Date();

        let dateBuckets: {
          dateStr: string;
          label: string;
          isMonthlyAggregate?: boolean;
          monthNum?: number;
          year?: number;
        }[] = [];

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
          // Month range: monthly aggregates supporting cross-year (e.g., Jul 2026 - Jul 2027)
          const startYear = selectedYear;
          const endYear = selectedYearEnd;
          const startMonth = selectedMonth;
          const endMonth = selectedMonthEnd;

          // Generate months from startYear/startMonth to endYear/endMonth
          let currentYear = startYear;
          let currentMonth = startMonth;

          while (true) {
            const mStr = String(currentMonth).padStart(2, '0');
            dateBuckets.push({
              dateStr: `${currentYear}-${mStr}`,
              label: `${BULAN_NAMES[currentMonth - 1]} ${currentYear}`,
              isMonthlyAggregate: true,
              monthNum: currentMonth,
              year: currentYear,
            });

            if (currentYear === endYear && currentMonth === endMonth) break;

            currentMonth++;
            if (currentMonth > 12) {
              currentMonth = 1;
              currentYear++;
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

          // Generate days between start and end (capped at 30 days max)
          const curr = new Date(start);
          let count = 0;
          while (curr <= end && count < 30) {
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

        if (period === 'bulan') {
          queryStartStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
          queryEndStr = `${selectedYearEnd}-${String(selectedMonthEnd).padStart(2, '0')}-31`;
        }

        // Fetch transactions for the entire date range
        const rawTxList = await transaksiService.getByDateRange(queryStartStr, queryEndStr);

        // Apply Branch Filter to Chart Data!
        const txList =
          selectedCabangFilter === 'Semua'
            ? rawTxList
            : rawTxList.filter((t) => (t.cabang || cabang1Name) === selectedCabangFilter);

        // Fetch detail items to calculate raw material costs
        const txIds = txList.map((t) => t.id!).filter(Boolean);
        const details =
          txIds.length > 0
            ? await Promise.all(txIds.map((id) => detailTransaksiService.getByTransaksiId(id))).then(
                (arr) => arr.flat()
              )
            : [];

        const detailsByTxId: Record<number, DetailTransaksi[]> = {};
        for (const det of details) {
          if (!detailsByTxId[det.transaksi_id]) {
            detailsByTxId[det.transaksi_id] = [];
          }
          detailsByTxId[det.transaksi_id].push(det);
        }

        // Fetch all menus for HPP per cabang lookup
        const allMenus = await menuService.getAll();
        const menuHppMap = new Map<number, Record<string, number>>();
        for (const m of allMenus) {
          if (m.id) {
            const perCabang = (m.biaya_per_cabang as Record<string, number>) || {};
            const withDefaults: Record<string, number> = {};
            cabangList.forEach((c) => {
              withDefaults[c] = perCabang[c] ?? m.biaya_bahan_baku ?? 0;
            });
            menuHppMap.set(m.id, withDefaults);
          }
        }

        // Fetch operational costs - filter by cabang
        let biayaList: Biaya[] = [];
        if (selectedCabangFilter === 'Semua') {
          biayaList = await biayaService.getByDateRange(queryStartStr, queryEndStr);
        } else {
          const allBiaya = await biayaService.getByDateRange(queryStartStr, queryEndStr);
          biayaList = allBiaya.filter(b => b.cabang === selectedCabangFilter);
        }

        const biayaByDate: Record<string, number> = {};
        for (const b of biayaList) {
          biayaByDate[b.tanggal] = (biayaByDate[b.tanggal] || 0) + (b.biaya_operasional || 0);
        }

        // Aggregate into ChartDataPoint objects
        const computedData: ChartDataPoint[] = dateBuckets.map((bucket) => {
          let dayTx: Transaksi[] = [];
          let dayOperasional = 0;

          if (bucket.isMonthlyAggregate && bucket.monthNum && bucket.year) {
            // Aggregate all transactions in this month (supports cross-year)
            const monthPrefix = `${bucket.year}-${String(bucket.monthNum).padStart(2, '0')}`;
            dayTx = txList.filter((t) => t.tanggal.startsWith(monthPrefix));
            // Aggregate operational costs in this month
            for (const b of biayaList) {
              if (b.tanggal.startsWith(monthPrefix)) {
                dayOperasional += (b.biaya_operasional || 0);
              }
            }
          } else {
            // Daily bucket
            dayTx = txList.filter((t) => t.tanggal === bucket.dateStr);
            // Tanpa record biaya → 0. JANGAN pakai default 150.000 (penyebab laba minus).
            dayOperasional = biayaByDate[bucket.dateStr] ?? 0;
          }

          // Tidak ada transaksi → semua angka 0 (laba/rugi TIDAK boleh minus)
          if (dayTx.length === 0) {
            return {
              tanggal: bucket.dateStr,
              label: bucket.label,
              penjualan: 0,
              biayaBahan: 0,
              biayaOperasional: 0,
              labaKotor: 0,
              labaBersih: 0,
              totalTransaksi: 0,
            };
          }

          const dayPenjualan = dayTx.reduce((sum, t) => sum + t.total, 0);

          let dayBahanCost = 0;
          for (const tx of dayTx) {
            const txItems = detailsByTxId[tx.id!] || [];
            const txCabang = tx.cabang || cabangList[0] || '';
            for (const item of txItems) {
              const menuHpp = item.menu_id ? menuHppMap.get(item.menu_id) : null;
              const hpp = menuHpp?.[txCabang] ?? menuHpp?.[cabangList[0] || ''] ?? item.biaya_bahan_baku ?? 0;
              dayBahanCost += (hpp || 0) * item.jumlah;
            }
          }

          const dayLabaKotor = dayPenjualan - dayBahanCost;
          const dayLaba = dayLabaKotor - dayOperasional;

          return {
            tanggal: bucket.dateStr,
            label: bucket.label,
            penjualan: dayPenjualan,
            biayaBahan: dayBahanCost,
            biayaOperasional: dayOperasional,
            labaKotor: dayLabaKotor,
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
  }, [
    period,
    selectedMonth,
    selectedMonthEnd,
    selectedYear,
    selectedYearEnd,
    monthViewMode,
    customStartDate,
    customEndDate,
    selectedCabangFilter,
  ]);

  // Show loading while KPI loads
  if (isLoadingKpi) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--utama)] border-t-[var(--utama)]" />
      </div>
    );
  }

  const totalCombinedToday = branchComparison.cabang1Sales + branchComparison.cabang2Sales;
  const c1Percent = totalCombinedToday > 0 ? Math.round((branchComparison.cabang1Sales / totalCombinedToday) * 100) : 50;
  const c2Percent = totalCombinedToday > 0 ? 100 - c1Percent : 50;

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Dashboard Top Header & Branch Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl font-bold text-[var(--teks)]">
            Dashboard Pemilik Usaha
          </h2>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Laporan penjualan, grafik keuangan, dan komparasi performa antar cabang warung.
          </p>
        </div>

        {/* Multi-Branch Filter Tabs Sederhana */}
        <div className="flex items-center gap-1 p-1 bg-[var(--latar)] rounded-lg border border-[var(--garis-kuat)] self-start md:self-auto text-xs">
          <button
            type="button"
            onClick={() => setSelectedCabangFilter('Semua')}
            className={`px-3 py-1.5 rounded font-medium transition cursor-pointer ${
              selectedCabangFilter === 'Semua'
                ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                : 'text-[var(--teks)] hover:text-[var(--teks)]'
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
                    ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                    : 'text-[var(--teks)] hover:text-[var(--teks)]'
                }`}
              >
                {cabang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Filter Notice Sederhana */}
      <div className="flex items-center justify-between mb-4 bg-[var(--kartu)] px-3.5 py-2.5 rounded-lg border border-[var(--garis)] text-xs">
        <div className="flex items-center gap-2 text-[var(--teks)]">
          <span className="font-medium text-[var(--redup)]">Filter Aktif:</span>
          <span className="px-2 py-0.5 rounded bg-[var(--utama-muda)] text-[var(--utama-teks)] font-semibold border border-[var(--garis)]">
            {selectedCabangFilter === 'Semua' ? 'Semua Cabang (Data Gabungan)' : `Data ${selectedCabangFilter}`}
          </span>
        </div>

        {selectedCabangFilter !== 'Semua' && (
          <button
            type="button"
            onClick={() => setSelectedCabangFilter('Semua')}
            className="text-xs font-semibold text-[var(--utama-teks)] hover:text-[var(--utama-teks)] hover:underline cursor-pointer"
          >
            ← Tampilkan Semua Cabang
          </button>
        )}
      </div>

      {/* 3 KPI Cards - Sederhana & Jelas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
        {/* Card 1: Penjualan Hari Ini */}
        <div className="bg-[var(--kartu)] rounded-xl p-4 sm:p-5 border border-[var(--garis)] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--redup)]">
              Total Penjualan Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--teks)] tracking-tight">
            {formatRupiah(todayPenjualan)}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--redup)]">
            <span className="font-medium text-[var(--teks)]">{todayTransaksiCount} transaksi</span>
            <span>({selectedCabangFilter === 'Semua' ? 'Semua Cabang' : selectedCabangFilter})</span>
          </div>
        </div>

        {/* Card 2: Total Transaksi */}
        <div className="bg-[var(--kartu)] rounded-xl p-4 sm:p-5 border border-[var(--garis)] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--redup)]">
              Total Transaksi Hari Ini
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--latar)] text-[var(--teks)] flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--teks)] tracking-tight">
            {todayTransaksiCount} <span className="text-base font-medium text-[var(--redup)]">Pesanan</span>
          </div>
          <div className="mt-1.5 text-xs text-[var(--redup)]">
            Rata-rata:{' '}
            <span className="font-semibold text-[var(--teks)]">
              {formatRupiah(todayTransaksiCount > 0 ? todayPenjualan / todayTransaksiCount : 0)}
            </span>
          </div>
        </div>

        {/* Card 3: Laba / Rugi Hari Ini */}
        <div className="bg-[var(--kartu)] rounded-xl p-4 sm:p-5 border border-[var(--garis)] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--redup)]">
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
          <div className="mt-1.5 text-[11px] text-[var(--redup)] flex items-center gap-1">
            <Info className="w-3 h-3 text-[var(--redup)] shrink-0" />
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
        selectedMonthEnd={selectedMonthEnd}
        onMonthEndChange={setSelectedMonthEnd}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        selectedYearEnd={selectedYearEnd}
        onYearEndChange={setSelectedYearEnd}
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
          className="p-4 rounded-xl bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center mb-2">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-[var(--teks)] group-hover:text-[var(--utama-teks)] transition">
            Menu Terlaris
          </h4>
          <p className="text-[11px] text-[var(--redup)] mt-0.5">Top 10 menu terpopuler</p>
        </button>

        <button
          onClick={() => onNavigate('biaya')}
          className="p-4 rounded-xl bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2">
            <DollarSign className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-[var(--teks)] group-hover:text-[var(--utama-teks)] transition">
            Pengaturan Biaya
          </h4>
          <p className="text-[11px] text-[var(--redup)] mt-0.5">Bahan baku & operasional</p>
        </button>

        <button
          onClick={() => onNavigate('ekspor')}
          className="p-4 rounded-xl bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-[var(--latar)] text-[var(--teks)] flex items-center justify-center mb-2">
            <Receipt className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-[var(--teks)] group-hover:text-[var(--utama-teks)] transition">
            Ekspor CSV
          </h4>
          <p className="text-[11px] text-[var(--redup)] mt-0.5">Download laporan transaksi</p>
        </button>

        <button
          onClick={() => onNavigate('biaya')}
          className="p-4 rounded-xl bg-[var(--kartu)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] hover:shadow-xs transition text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-2">
            <Tag className="w-4 h-4" />
          </div>
          <h4 className="font-semibold text-xs sm:text-sm text-[var(--teks)] group-hover:text-[var(--utama-teks)] transition">
            Kelola Promo
          </h4>
          <p className="text-[11px] text-[var(--redup)] mt-0.5">Diskon & voucher toko</p>
        </button>
      </div>
    </div>
  );
};