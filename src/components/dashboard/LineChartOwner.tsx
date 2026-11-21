/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  DollarSign,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  X,
} from 'lucide-react';
import { formatRupiah, formatDateIndo, getFormattedDate } from '../../utils/formatters';

export interface ChartDataPoint {
  tanggal: string;
  label: string;
  penjualan: number;
  biayaBahan: number;
  biayaOperasional: number;
  labaKotor: number; // Gross Profit = penjualan - biayaBahan
  labaBersih: number; // Net Profit = labaKotor - biayaOperasional
  totalTransaksi: number;
}

export type ChartPeriod = '7-hari' | '30-hari' | 'bulan' | 'custom';
export type MonthViewMode = 'daily' | 'yearly';

export const BULAN_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

interface LineChartOwnerProps {
  chartData: ChartDataPoint[];
  period: ChartPeriod;
  onPeriodChange: (p: ChartPeriod) => void;
  selectedMonth: number; // 1-12 (start month)
  onMonthChange: (m: number) => void;
  selectedMonthEnd: number; // 1-12 (end month)
  onMonthEndChange: (m: number) => void;
  selectedYear: number; // start year
  onYearChange: (y: number) => void;
  selectedYearEnd: number; // end year
  onYearEndChange: (y: number) => void;
  monthViewMode: MonthViewMode;
  onMonthViewModeChange: (mode: MonthViewMode) => void;
  customStartDate: string;
  onCustomStartDateChange: (val: string) => void;
  customEndDate: string;
  onCustomEndDateChange: (val: string) => void;
  isLoading: boolean;
}

// Generate smooth bezier curve path for SVG
function getSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

// Generate closed area path for gradient under the line
function getAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length < 2) return '';
  const linePath = getSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${baselineY} L ${first.x} ${baselineY} Z`;
}

export const LineChartOwner: React.FC<LineChartOwnerProps> = ({
  chartData,
  period,
  onPeriodChange,
  selectedMonth,
  onMonthChange,
  selectedMonthEnd,
  onMonthEndChange,
  selectedYear,
  onYearChange,
  selectedYearEnd,
  onYearEndChange,
  monthViewMode,
  onMonthViewModeChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  isLoading,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [showSales, setShowSales] = useState(true);
  const [showProfit, setShowProfit] = useState(true);
  const [showGrossProfit, setShowGrossProfit] = useState(true);

  // Popup "Rentang Tanggal" — pilih tanggal mulai & selesai lewat dialog (bukan panel inline)
  const [showRangePopup, setShowRangePopup] = useState(false);
  const [draftStart, setDraftStart] = useState(customStartDate);
  const [draftEnd, setDraftEnd] = useState(customEndDate);
  // Field yang sedang dipilih di popup: 'start' (Dari) atau 'end' (Sampai)
  const [activeField, setActiveField] = useState<'start' | 'end'>('start');

  // Batas maksimum rentang tanggal (dipakai popup & kalender)
  const RANGE_MAX_DAYS = 30;

  /** "Sampai" tidak boleh sebelum "Dari" dan tidak boleh melewati "Dari" + 30 hari */
  const clampEndDate = (startStr: string, endStr: string): string => {
    if (!startStr) return endStr;
    if (!endStr || endStr < startStr) return startStr;
    const maxEnd = new Date(`${startStr}T00:00:00`);
    maxEnd.setDate(maxEnd.getDate() + RANGE_MAX_DAYS);
    const maxEndStr = getFormattedDate(maxEnd);
    return endStr > maxEndStr ? maxEndStr : endStr;
  };

  const openRangePopup = () => {
    const s = customStartDate;
    setDraftStart(s);
    // Normalisasi rentang lama yang mungkin sudah > 30 hari
    setDraftEnd(clampEndDate(s, customEndDate));
    setActiveField('start');
    setShowRangePopup(true);
  };

  // Klik 1 hari di kalender → isi field yang sedang aktif (Dari dulu, lalu Sampai)
  const pickRangeDay = (dateStr: string) => {
    if (activeField === 'start') {
      setDraftStart(dateStr);
      // Sampai otomatis dijaga: tidak sebelum Dari, maksimal Dari + 30 hari
      setDraftEnd(clampEndDate(dateStr, draftEnd));
      setActiveField('end');
    } else {
      if (dateStr < draftStart) {
        // Klik sebelum Dari (seharusnya tidak mungkin, tapi amankan): mulai rentang baru
        setDraftStart(dateStr);
        setDraftEnd(dateStr);
        setActiveField('start');
        return;
      }
      setDraftEnd(clampEndDate(draftStart, dateStr));
      // tetap di field "Sampai" agar user bisa menggeser tanggal selesai
    }
  };

  const applyRangePopup = () => {
    const s = draftStart || customStartDate;
    const e = clampEndDate(s, draftEnd || customEndDate);
    onCustomStartDateChange(s);
    onCustomEndDateChange(e);
    setShowRangePopup(false);
    setActiveField('start');
    setSelectedPointIndex(null);
  };

  // Durasi rentang yang sedang dipilih (indikator di popup)
  const rangeDays =
    draftStart && draftEnd && draftEnd >= draftStart
      ? Math.round(
          (new Date(`${draftEnd}T00:00:00`).getTime() - new Date(`${draftStart}T00:00:00`).getTime()) / 86400000
        ) + 1
      : 0;

  const uid = useId().replace(/:/g, '');

  // Computed max end date for custom range (30 days max)
  const maxEndDate = (() => {
    const d = new Date(customStartDate);
    d.setDate(d.getDate() + 29);
    return d.toISOString().split('T')[0];
  })();

  // Ensure at least one line is always visible
  const anyLineVisible = showSales || showProfit || showGrossProfit;
  const effectiveShowSales = showSales && anyLineVisible;
  const effectiveShowProfit = showProfit && anyLineVisible;
  const effectiveShowGrossProfit = showGrossProfit && anyLineVisible;

  // Summary calculations for the filtered period
  const totalOmzet = chartData.reduce((acc, curr) => acc + curr.penjualan, 0);
  const totalLaba = chartData.reduce((acc, curr) => acc + curr.labaBersih, 0);
  const totalLabaKotor = chartData.reduce((acc, curr) => acc + curr.labaKotor, 0);
  const totalTx = chartData.reduce((acc, curr) => acc + curr.totalTransaksi, 0);
  const avgOmzetPerDay = chartData.length > 0 ? totalOmzet / chartData.length : 0;

  // Chart coordinate space (logical units for viewBox — SVG scales responsively)
  const svgWidth = 1000;
  const svgHeight = 320;
  const padLeft = 80;
  const padRight = 30;
  const padTop = 38;
  const padBottom = 45;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Calculate min & max values for scaling (include all visible metrics)
  const allValues = chartData.flatMap((d) => [
    d.penjualan,
    d.labaBersih,
    d.labaKotor,
  ]);
  const maxValueRaw = Math.max(...allValues, 100000);
  const minValueRaw = Math.min(...allValues, 0);

  // Round max value to clean steps (e.g. 500k, 1M, 2M)
  const maxVal = Math.ceil(maxValueRaw / 100000) * 100000 || 500000;
  const minVal = minValueRaw < 0 ? Math.floor(minValueRaw / 100000) * 100000 : 0;
  const valRange = maxVal - minVal || 1;

  // Mapping function from value to Y coordinate
  const getY = (val: number) => {
    const norm = (val - minVal) / valRange;
    return padTop + plotHeight * (1 - norm);
  };

  // Mapping function from index to X coordinate
  const getX = (idx: number) => {
    if (chartData.length <= 1) return padLeft + plotWidth / 2;
    return padLeft + (idx / (chartData.length - 1)) * plotWidth;
  };

  // Coordinate points
  const salesPoints = chartData.map((d, idx) => ({
    x: getX(idx),
    y: getY(d.penjualan),
    data: d,
  }));

  const profitPoints = chartData.map((d, idx) => ({
    x: getX(idx),
    y: getY(d.labaBersih),
    data: d,
  }));

  const grossProfitPoints = chartData.map((d, idx) => ({
    x: getX(idx),
    y: getY(d.labaKotor),
    data: d,
  }));

  const salesPath = getSmoothPath(salesPoints);
  const profitPath = getSmoothPath(profitPoints);
  const grossProfitPath = getSmoothPath(grossProfitPoints);
  const salesArea = getAreaPath(salesPoints, baselineY);
  const profitArea = getAreaPath(profitPoints, baselineY);
  const grossProfitArea = getAreaPath(grossProfitPoints, baselineY);

  // 4 Y-axis tick lines
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const val = minVal + (valRange * i) / tickCount;
    return { val, y: getY(val) };
  });

  // Smart X-axis label skip to prevent overlapping on mobile/desktop
  const getLabelInterval = () => {
    const len = chartData.length;
    if (len <= 8) return 1;
    if (len <= 15) return 2;
    if (len <= 31) return Math.ceil(len / 8);
    return Math.ceil(len / 10);
  };
  const labelInterval = getLabelInterval();

  // Active point is either hovered or explicitly clicked/selected
  const activeIdx = hoveredIndex !== null ? hoveredIndex : selectedPointIndex;
  const currentHovered = activeIdx !== null && activeIdx >= 0 && activeIdx < chartData.length ? chartData[activeIdx] : null;

  const ptSales = activeIdx !== null ? salesPoints[activeIdx] : null;
  const ptProfit = activeIdx !== null ? profitPoints[activeIdx] : null;
  const ptGrossProfit = activeIdx !== null ? grossProfitPoints[activeIdx] : null;

  return (
    <div className="bg-[var(--kartu)] rounded-lg p-3.5 sm:p-5 border border-[var(--garis-kuat)] shadow-sm mb-5 space-y-3.5">
      {/* 1. Header & Period Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--garis)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[var(--teks)] tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--utama-teks)]" />
              <span>Grafik Garis Penjualan & Laba</span>
            </h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-[var(--latar)] text-[var(--teks)] border border-[var(--garis)]">
              Line Chart
            </span>
          </div>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Arahkan kursor atau ketuk titik bulatan pada grafik untuk melihat rincian nominal.
          </p>
        </div>

        {/* 4 Period Chips: 7 Hari, 30 Hari, Berdasarkan Bulan, Rentang Tanggal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[var(--latar)] p-1 rounded-lg border border-[var(--garis)] w-full lg:w-auto text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={() => {
              onPeriodChange('7-hari');
              setSelectedPointIndex(null);
            }}
            className={`min-h-[34px] px-3 py-1.5 rounded font-medium transition flex items-center justify-center whitespace-nowrap cursor-pointer ${
              period === '7-hari'
                ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                : 'text-[var(--teks)] hover:text-[var(--teks)]'
            }`}
          >
            7 Hari
          </button>
          <button
            type="button"
            onClick={() => {
              onPeriodChange('30-hari');
              setSelectedPointIndex(null);
            }}
            className={`min-h-[34px] px-3 py-1.5 rounded font-medium transition flex items-center justify-center whitespace-nowrap cursor-pointer ${
              period === '30-hari'
                ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                : 'text-[var(--teks)] hover:text-[var(--teks)]'
            }`}
          >
            30 Hari
          </button>
          <button
            type="button"
            onClick={() => {
              onPeriodChange('bulan');
              setSelectedPointIndex(null);
            }}
            className={`min-h-[34px] px-3 py-1.5 rounded font-medium transition flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
              period === 'bulan'
                ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                : 'text-[var(--teks)] hover:text-[var(--teks)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Per Bulan</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onPeriodChange('custom');
              setSelectedPointIndex(null);
              openRangePopup();
            }}
            className={`min-h-[34px] px-2 sm:px-3 py-1.5 rounded font-medium transition flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
              period === 'custom'
                ? 'bg-[var(--utama)] text-white font-semibold shadow-xs'
                : 'text-[var(--teks)] hover:text-[var(--teks)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>Rentang Tanggal</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Filters: Per Bulan (Range Bulan - support cross-year, e.g. Jul 2026 - Jul 2027) */}
      {period === 'bulan' && (
        <div className="bg-[var(--utama-muda)]/70 border border-[var(--garis)]/80 rounded-2xl p-3 sm:p-3.5 space-y-2 w-full min-w-0 overflow-hidden animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--utama-teks)]">
            <Calendar className="w-4 h-4 text-[var(--utama-teks)] shrink-0" />
            <span>Pilih Rentang Bulan (maks 12 bulan):</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
            <div className="min-w-0 space-y-2">
              <label className="text-[10px] font-semibold text-[var(--redup)] block mb-1 truncate">Dari Bulan</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(Number(e.target.value))}
                  className="min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                >
                  {BULAN_NAMES.map((bName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {bName}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => onYearChange(Number(e.target.value))}
                  className="min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[10px] font-semibold text-[var(--redup)] block mb-1 truncate">Sampai Bulan</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedMonthEnd || selectedMonth}
                  onChange={(e) => onMonthEndChange(Number(e.target.value))}
                  className="min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                >
                  {BULAN_NAMES.map((bName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {bName}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYearEnd}
                  onChange={(e) => onYearEndChange(Number(e.target.value))}
                  className="min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-[var(--kartu)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] text-[var(--teks)] box-border"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Rentang Tanggal — tombol ringkas 1 baris, pemilihan tanggal lewat popup (lihat bagian bawah) */}

      {/* 3. Line Display Toggles - Urutan: Merah (Omzet), Kuning (Laba Kotor), Hijau (Laba Bersih) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => {
              const newVal = !showSales;
              // Prevent turning off if it's the last one visible
              if (!newVal && !showGrossProfit && !showProfit) return;
              setShowSales(newVal);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border transition active:scale-95 ${
              showSales
                ? 'bg-[var(--utama)]/10 text-[var(--utama-teks)] border-[var(--utama-teks)]/30 shadow-2xs'
                : 'bg-[var(--latar)] text-[var(--redup)] border-[var(--garis)] opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--utama)]" />
            <span>Omzet</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newVal = !showGrossProfit;
              if (!newVal && !showSales && !showProfit) return;
              setShowGrossProfit(newVal);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border transition active:scale-95 ${
              showGrossProfit
                ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-2xs'
                : 'bg-[var(--latar)] text-[var(--redup)] border-[var(--garis)] opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Laba Kotor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const newVal = !showProfit;
              if (!newVal && !showSales && !showGrossProfit) return;
              setShowProfit(newVal);
            }}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border transition active:scale-95 ${
              showProfit
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-[var(--latar)] text-[var(--redup)] border-[var(--garis)] opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-emerald-700">Laba Bersih</span>
          </button>
        </div>
      </div>

      {/* 4. Interactive SVG Line Chart */}
      <div className="relative w-full overflow-hidden">
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-xs font-semibold text-[var(--redup)] bg-[var(--latar)]/50 rounded-2xl">
            Memuat data grafik garis...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs font-semibold text-[var(--redup)] bg-[var(--latar)]/50 rounded-2xl">
            Tidak ada data transaksi pada rentang periode ini.
          </div>
        ) : (
          <div className="w-full" style={{ aspectRatio: `${svgWidth} / ${svgHeight}`, minHeight: '200px' }}>
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
              className="chart overflow-visible"
            >
                <defs>
                  {/* Gradient for Sales (Orange) */}
                  <linearGradient id={`salesGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: 'var(--utama)' }} stopOpacity="0.25" />
                    <stop offset="100%" style={{ stopColor: 'var(--utama)' }} stopOpacity="0.0" />
                  </linearGradient>

                  {/* Gradient for Profit (Emerald) */}
                  <linearGradient id={`profitGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Gradient for Gross Profit (Yellow/Amber) */}
                  <linearGradient id={`grossProfitGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines and Y labels */}
                {yTicks.map((tick, i) => (
                  <g key={i}>
                    <line
                      x1={padLeft}
                      y1={tick.y}
                      x2={svgWidth - padRight}
                      y2={tick.y}
                      style={{ stroke: 'var(--garis)' }}
                      strokeWidth="1"
                      strokeDasharray={i === 0 ? 'none' : '4 4'}
                    />
                    <text
                      x={padLeft - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="bold"
                      style={{ fill: 'var(--redup)' }}
                    >
                      {formatRupiah(tick.val)}
                    </text>
                  </g>
                ))}

                {/* Profit Area & Line (Green) - drawn first = bottom */}
                {effectiveShowProfit && profitArea && (
                  <path d={profitArea} fill={`url(#profitGrad_${uid})`} />
                )}
                {effectiveShowProfit && profitPath && (
                  <path
                    d={profitPath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Gross Profit Area & Line (Yellow) - drawn second = middle (on top of Green) */}
                {effectiveShowGrossProfit && grossProfitArea && (
                  <path d={grossProfitArea} fill={`url(#grossProfitGrad_${uid})`} />
                )}
                {effectiveShowGrossProfit && grossProfitPath && (
                  <path
                    d={grossProfitPath}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="8 4"
                  />
                )}

                {/* Sales Area & Line (Red) - drawn last = top */}
                {showSales && salesArea && (
                  <path d={salesArea} fill={`url(#salesGrad_${uid})`} />
                )}
                {showSales && salesPath && (
                  <path
                    d={salesPath}
                    fill="none"
                    style={{ stroke: 'var(--utama)' }}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover vertical guide line */}
                {activeIdx !== null && (
                  <line
                    x1={getX(activeIdx)}
                    y1={padTop}
                    x2={getX(activeIdx)}
                    y2={baselineY}
                    style={{ stroke: 'var(--teks)' }}
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="opacity-50"
                  />
                )}

                {/* Data Points (Dots) for Profit - drawn first = bottom */}
                {effectiveShowProfit &&
                  profitPoints.map((pt, idx) => {
                    const isSelected = activeIdx === idx;
                    return (
                      <g key={`profit-pt-${idx}`} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : chartData.length > 20 ? 2.5 : 3.5}
                          style={{ fill: '#10B981', stroke: 'var(--kartu)' }}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="transition-all duration-150"
                          onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                        />
                      </g>
                    );
                  })}

                {/* Data Points (Dots) for Gross Profit - drawn second = middle (on top of Green) */}
                {effectiveShowGrossProfit &&
                  grossProfitPoints.map((pt, idx) => {
                    const isSelected = activeIdx === idx;
                    return (
                      <g key={`gross-pt-${idx}`} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : chartData.length > 20 ? 2.5 : 3.5}
                          style={{ fill: '#F59E0B', stroke: 'var(--kartu)' }}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="transition-all duration-150"
                          onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                        />
                      </g>
                    );
                  })}

                {/* Data Points (Dots) for Sales - drawn last = top */}
                {showSales &&
                  salesPoints.map((pt, idx) => {
                    const isSelected = activeIdx === idx;
                    return (
                      <g key={`sales-pt-${idx}`} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6.5 : chartData.length > 20 ? 3 : 4}
                          style={{ fill: 'var(--utama)', stroke: 'var(--kartu)' }}
                          strokeWidth={isSelected ? 3 : 2}
                          className="transition-all duration-150"
                          onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                        />
                      </g>
                    );
                  })}

                {/* FLOATING NUMBER BADGES - Nominal di samping kanan titik bulatan, stacked vertically */}
                {activeIdx !== null && chartData[activeIdx] && (
                  <>
                    {/* Collect visible points for vertical stacking - smart algorithm avoids top/bottom clipping */}
                    {(() => {
                      const points = [
                        { key: 'sales', show: showSales, pt: ptSales, color: 'var(--utama)', hexColor: 'var(--utama)', value: formatRupiah(chartData[activeIdx].penjualan), label: 'Omzet' },
                        { key: 'gross', show: effectiveShowGrossProfit, pt: ptGrossProfit, color: '#F59E0B', hexColor: '#F59E0B', value: formatRupiah(chartData[activeIdx].labaKotor), label: 'Laba Kotor' },
                        { key: 'profit', show: effectiveShowProfit, pt: ptProfit, color: '#10B981', hexColor: '#10B981', value: formatRupiah(chartData[activeIdx].labaBersih), label: 'Laba Bersih' },
                      ].filter(p => p.show && p.pt);

                      if (points.length === 0) return null;

                      // Calculate badge positions with smart vertical stacking
                      const badgeHeight = 22;
                      const badgeGap = 6;
                      const minY = padTop + 2;
                      const maxY = baselineY - badgeHeight - 2;
                      const plotCenterY = (minY + maxY) / 2;

                      // Ideal Y for each badge (centered on its point)
                      const idealYs = points.map(p => p.pt!.y - badgeHeight / 2);

                      // Detect if we're near top/bottom edge - if so, stack from center instead of first point
                      const avgIdealY = idealYs.reduce((a, b) => a + b, 0) / idealYs.length;
                      const nearTop = avgIdealY < minY + 30;
                      const nearBottom = avgIdealY > maxY - 30;

                      // Start Y: center of stack at plot center if near edge, else at average ideal Y
                      const stackCenterY = (nearTop || nearBottom) ? plotCenterY : avgIdealY;
                      const startY = stackCenterY - (points.length - 1) * (badgeHeight + badgeGap) / 2;

                      // Ensure entire stack fits in bounds
                      const finalStartY = Math.max(minY, Math.min(startY, maxY - (points.length - 1) * (badgeHeight + badgeGap)));

                      return (
                        <>
                          {points.map((p, i) => {
                            const baseY = finalStartY + i * (badgeHeight + badgeGap);
                            const text = p.value;
                            // Approximate text width: 7px per char + 24px padding
                            const textWidth = Math.max(56, text.length * 7 + 24);
                            const badgeX = p.pt!.x + 14;
                            // Clamp to stay within SVG bounds (svgWidth - padRight - textWidth - 10)
                            const clampedX = Math.min(badgeX, svgWidth - padRight - textWidth - 4);
                            const clampedY = Math.max(minY, Math.min(maxY, baseY));

                            return (
                              <g key={p.key} className="transition-all duration-200 pointer-events-none animate-zoom-in animate-fade-in animate-slide-in-left">
                                {/* Enhanced dot with ring */}
                                <circle
                                  cx={p.pt!.x}
                                  cy={p.pt!.y}
                                  r={p.key === 'sales' ? 10 : 9}
                                  style={{ fill: p.color }}
                                  fillOpacity="0.15"
                                />
                                <circle
                                  cx={p.pt!.x}
                                  cy={p.pt!.y}
                                  r={p.key === 'sales' ? 5.5 : 5}
                                  style={{ fill: p.color, stroke: 'var(--kartu)' }}
                                  strokeWidth={p.key === 'sales' ? 2.5 : 2}
                                />

                                {/* Connector line from dot to badge */}
                                <line
                                  x1={p.pt!.x + (p.key === 'sales' ? 7 : 6)}
                                  y1={p.pt!.y}
                                  x2={clampedX}
                                  y2={clampedY + badgeHeight / 2}
                                  style={{ stroke: p.color, strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.6 }}
                                />

                                {/* Badge background */}
                                <g transform={`translate(${clampedX}, ${clampedY})`}>
                                  <rect
                                    x="0"
                                    y="0"
                                    width={textWidth}
                                    height={badgeHeight}
                                    rx="5"
                                    style={{ fill: p.color }}
                                    filter="drop-shadow(0 3px 8px rgba(0,0,0,0.15))"
                                  />
                                  {/* Left accent bar */}
                                  <rect
                                    x="0"
                                    y="0"
                                    width="4"
                                    height={badgeHeight}
                                    rx="5"
                                    style={{ fill: 'white', fillOpacity: 0.25 }}
                                  />
                                  <text
                                    x={textWidth / 2}
                                    y={15}
                                    textAnchor="middle"
                                    fontSize="10.5"
                                    fontWeight="800"
                                    fill="white"
                                    fontFamily="system-ui, -apple-system, sans-serif"
                                    letterSpacing="-0.15"
                                  >
                                    {text}
                                  </text>
                                </g>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </>
                )}

                {/* X-Axis Day/Date Labels */}
                {chartData.map((d, idx) => {
                  const shouldShow =
                    idx === 0 ||
                    idx === chartData.length - 1 ||
                    idx % labelInterval === 0 ||
                    activeIdx === idx;

                  if (!shouldShow) return null;
                  const isSelected = activeIdx === idx;

                  return (
                    <text
                      key={`label-${idx}`}
                      x={getX(idx)}
                      y={baselineY + 20}
                      textAnchor="middle"
                      fontSize={isSelected ? '11' : '10'}
                      fontWeight={isSelected ? 'bold' : '600'}
                      style={{ fill: isSelected ? 'var(--utama)' : 'var(--redup)' }}
                      className="transition-colors cursor-pointer"
                      onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                    >
                      {d.label}
                    </text>
                  );
                })}

                {/* Transparent Interactive Click/Touch overlay columns */}
                {chartData.map((d, idx) => {
                  const colWidth = plotWidth / chartData.length;
                  const colX = getX(idx) - colWidth / 2;
                  return (
                    <rect
                      key={`hit-${idx}`}
                      x={colX}
                      y={padTop}
                      width={colWidth}
                      height={plotHeight}
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onTouchStart={() => {
                        setHoveredIndex(idx);
                        setSelectedPointIndex(idx);
                      }}
                    />
                  );
                })}
              </svg>
          </div>
        )}
      </div>

      {/* 5. Tooltip Card / Detail Preview - Format: Omzet: Rp... Laba Kotor: Rp... Laba Bersih: Rp... */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-[var(--latar)] border border-[var(--garis)]/80">
        {currentHovered ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-2 p-2 bg-[var(--utama-muda)]/50 rounded-xl border border-[var(--garis)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--utama)] shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-[var(--redup)] block">Omzet</span>
                <span className="font-extrabold text-[var(--utama-teks)]">{formatRupiah(currentHovered.penjualan)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-amber-50/50 rounded-xl border border-[var(--garis)]">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-[var(--redup)] block">Laba Kotor</span>
                <span className={`font-extrabold ${currentHovered.labaKotor >= 0 ? 'text-amber-700' : 'text-rose-600'}`}>{formatRupiah(currentHovered.labaKotor)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50/70 rounded-xl border border-[var(--garis)]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <span className="text-[10px] font-semibold text-[var(--redup)] block">Laba Bersih</span>
                <span className={`font-extrabold ${currentHovered.labaBersih >= 0 ? 'text-emerald-700' : 'text-[var(--bahaya-teks)]'}`}>{formatRupiah(currentHovered.labaBersih)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--redup)] flex items-center justify-center gap-1.5 py-1">
            <Info className="w-3.5 h-3.5 text-[var(--utama-teks)]" />
            <span>Arahkan kursor atau ketuk titik bulatan grafik untuk melihat detail nominal.</span>
          </div>
        )}
      </div>

      {/* 6. POPUP RENTANG TANGGAL - user memilih tanggal berapa sd berapa */}
      {showRangePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRangePopup(false);
          }}
        >
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl border border-[var(--garis)] animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Popup Header */}
            <div className="flex items-center justify-between p-4 bg-[var(--latar)] border-b border-[var(--garis)]">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-5 h-5 text-[var(--utama-teks)] shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-bold text-[var(--teks)] text-sm">Rentang Tanggal</h3>
                  <p className="text-[11px] text-[var(--redup)] truncate">
                    Pilih tanggal berapa sd berapa (maks 30 hari)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRangePopup(false)}
                className="p-1 rounded-lg text-[var(--redup)] hover:bg-[var(--garis)]/50 shrink-0"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-2.5">
              {/* Petunjuk langkah: Dari dulu, lalu Sampai */}
              <p className="text-[11px] leading-relaxed text-[var(--redup)]">
                Klik tanggal{' '}
                <span className={`font-bold ${activeField === 'start' ? 'text-[var(--utama-teks)] underline' : 'text-[var(--teks)]'}`}>
                  Dari
                </span>{' '}
                lebih dulu pada kalender, lalu klik tanggal{' '}
                <span className={`font-bold ${activeField === 'end' ? 'text-[var(--utama-teks)] underline' : 'text-[var(--teks)]'}`}>
                  Sampai
                </span>
                . Rentang saat ini:{' '}
                <span className="font-bold text-[var(--teks)]">{rangeDays} hari</span> (maks {RANGE_MAX_DAYS} hari).
              </p>

              {/* Ringkasan rentang terpilih — diklik untuk ganti field yang sedang dipilih */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveField('start')}
                  className={`text-left rounded-xl px-3 py-2 min-w-0 border transition cursor-pointer ${
                    activeField === 'start'
                      ? 'bg-[var(--utama-muda)] border-[var(--utama-teks)] ring-2 ring-[var(--utama-teks)]/25'
                      : 'bg-[var(--latar)] border-[var(--garis)] hover:border-[var(--garis-kuat)]'
                  }`}
                >
                  <div className="text-[10px] font-semibold text-[var(--redup)] mb-0.5">
                    Dari {activeField === 'start' && <span className="text-[var(--utama-teks)]">• sedang dipilih</span>}
                  </div>
                  <div className="font-bold text-[var(--teks)] truncate">
                    {draftStart
                      ? new Date(draftStart).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveField('end')}
                  className={`text-left rounded-xl px-3 py-2 min-w-0 border transition cursor-pointer ${
                    activeField === 'end'
                      ? 'bg-[var(--utama-muda)] border-[var(--utama-teks)] ring-2 ring-[var(--utama-teks)]/25'
                      : 'bg-[var(--latar)] border-[var(--garis)] hover:border-[var(--garis-kuat)]'
                  }`}
                >
                  <div className="text-[10px] font-semibold text-[var(--redup)] mb-0.5">
                    Sampai {activeField === 'end' && <span className="text-[var(--utama-teks)]">• sedang dipilih</span>}
                  </div>
                  <div className="font-bold text-[var(--teks)] truncate">
                    {draftEnd
                      ? new Date(draftEnd).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </button>
              </div>

              {/* Kalender pilih rentang */}
              <DateRangeCalendar
                startDate={draftStart}
                endDate={draftEnd}
                maxDays={RANGE_MAX_DAYS}
                activeField={activeField}
                onPickDay={pickRangeDay}
              />

              {/* Aksi popup */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowRangePopup(false)}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold bg-[var(--latar)] text-[var(--teks)] border border-[var(--garis)] hover:bg-[var(--garis)]/60 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={applyRangePopup}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold bg-[var(--utama)] text-white hover:opacity-90 transition cursor-pointer"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ===== Date Range Calendar Component =====
interface DateRangeCalendarProps {
  startDate: string; // nilai "Dari" — dipakai highlight & batas maks
  endDate: string; // nilai "Sampai" — dipakai highlight
  maxDays: number;
  /** Field yang sedang dipilih user: 'start' = memilih Dari, 'end' = memilih Sampai */
  activeField: 'start' | 'end';
  /** Semua klik hari diteruskan ke popup (alur pilih 2 langkah: Dari dulu, lalu Sampai) */
  onPickDay: (dateStr: string) => void;
}

const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  maxDays,
  activeField,
  onPickDay,
}) => {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = startDate ? new Date(startDate) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewMonth.year, viewMonth.month, 1).getDay();
  const todayStr = getFormattedDate(new Date());

  const prevMonth = () => setViewMonth(m => ({ year: m.month === 0 ? m.year - 1 : m.year, month: m.month === 0 ? 11 : m.month - 1 }));
  const nextMonth = () => setViewMonth(m => ({ year: m.month === 11 ? m.year + 1 : m.year, month: m.month === 11 ? 0 : m.month + 1 }));

  const isDateInRange = (dateStr: string) => {
    if (!startDate || !endDate) return false;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const isDateSelected = (dateStr: string) => dateStr === startDate || dateStr === endDate;

  const handleDayClick = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onPickDay(dateStr);
  };

  const isDisabled = (day: number) => {
    const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Saat memilih "Dari", semua tanggal bebas dipilih
    if (activeField === 'start' || !startDate) return false;
    // Saat memilih "Sampai": tidak boleh sebelum Dari, dan maks maxDays hari
    if (dateStr < startDate) return true;
    const start = new Date(startDate);
    const clicked = new Date(dateStr);
    const diffDays = Math.floor((clicked.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > maxDays;
  };

  return (
    <div className="bg-[var(--kartu)] rounded-xl border border-[var(--garis)] p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-[var(--latar)] text-[var(--teks)]" aria-label="Bulan sebelumnya">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-sm text-[var(--teks)] capitalize">
          {new Date(viewMonth.year, viewMonth.month).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
        </span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-[var(--latar)] text-[var(--teks)]" aria-label="Bulan berikutnya">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-[var(--redup)] py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const inRange = isDateInRange(dateStr);
          const selected = isDateSelected(dateStr);
          const disabled = isDisabled(day);
          const isToday = dateStr === todayStr;

          return (
            <button
              key={day}
              type="button"
              onClick={() => !disabled && handleDayClick(day)}
              disabled={disabled}
              className={`aspect-square relative rounded-lg text-xs font-medium transition-all active:scale-95 ${
                selected ? 'bg-[var(--utama)] text-white shadow-xs z-10'
                : inRange ? 'bg-[var(--utama-muda)]/50 text-[var(--utama-teks)]'
                : disabled ? 'text-[var(--redup)]/40 cursor-not-allowed'
                : 'text-[var(--teks)] hover:bg-[var(--latar)]'
              } ${isToday && !selected && !inRange ? 'ring-2 ring-[var(--utama-teks)]' : ''}`}
            >
              {day}
              {inRange && !selected && <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[var(--utama)]/30 -translate-y-1/2" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-3 text-[10px] text-[var(--redup)]">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--utama)]" /> Dipilih</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[var(--utama-muda)]/50 border border-[var(--garis)]" /> Dalam Rentang</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded border border-[var(--utama-teks)]" /> Hari Ini</span>
      </div>
    </div>
  );
};


