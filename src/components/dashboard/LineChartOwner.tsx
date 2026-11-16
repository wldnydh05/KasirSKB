/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useId } from 'react';
import {
  Calendar,
  ChevronDown,
  TrendingUp,
  DollarSign,
  Receipt,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Info,
} from 'lucide-react';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';

export interface ChartDataPoint {
  tanggal: string;
  label: string;
  penjualan: number;
  biayaBahan: number;
  biayaOperasional: number;
  labaBersih: number;
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
  selectedMonth: number; // 1-12
  onMonthChange: (m: number) => void;
  selectedYear: number;
  onYearChange: (y: number) => void;
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
  selectedYear,
  onYearChange,
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

  const uid = useId().replace(/:/g, '');

  // Summary calculations for the filtered period
  const totalOmzet = chartData.reduce((acc, curr) => acc + curr.penjualan, 0);
  const totalLaba = chartData.reduce((acc, curr) => acc + curr.labaBersih, 0);
  const totalTx = chartData.reduce((acc, curr) => acc + curr.totalTransaksi, 0);
  const avgOmzetPerDay = chartData.length > 0 ? totalOmzet / chartData.length : 0;

  // Chart coordinate space
  const svgWidth = 1000;
  const svgHeight = 320;
  const padLeft = 80;
  const padRight = 30;
  const padTop = 38;
  const padBottom = 45;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;
  const baselineY = padTop + plotHeight;

  // Calculate min & max values for scaling
  const allValues = chartData.flatMap((d) => [d.penjualan, d.labaBersih]);
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

  const salesPath = getSmoothPath(salesPoints);
  const profitPath = getSmoothPath(profitPoints);
  const salesArea = getAreaPath(salesPoints, baselineY);
  const profitArea = getAreaPath(profitPoints, baselineY);

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

  const badgeWidth = 98;
  const badgeHalf = badgeWidth / 2;
  const clampedSalesX = ptSales
    ? Math.max(padLeft + badgeHalf, Math.min(svgWidth - padRight - badgeHalf, ptSales.x))
    : 0;
  const clampedProfitX = ptProfit
    ? Math.max(padLeft + badgeHalf, Math.min(svgWidth - padRight - badgeHalf, ptProfit.x))
    : 0;

  return (
    <div className="bg-white rounded-lg p-3.5 sm:p-5 border border-gray-300 shadow-sm mb-5 space-y-3.5">
      {/* 1. Header & Period Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <span>Grafik Garis Penjualan & Laba</span>
            </h3>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
              Line Chart
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Arahkan kursor atau ketuk titik bulatan pada grafik untuk melihat rincian nominal.
          </p>
        </div>

        {/* 4 Period Chips: 7 Hari, 30 Hari, Berdasarkan Bulan, Rentang Tanggal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 w-full lg:w-auto text-xs">
          <button
            type="button"
            onClick={() => {
              onPeriodChange('7-hari');
              setSelectedPointIndex(null);
            }}
            className={`min-h-[34px] px-3 py-1.5 rounded font-medium transition flex items-center justify-center whitespace-nowrap cursor-pointer ${
              period === '7-hari'
                ? 'bg-orange-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900'
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
                ? 'bg-orange-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900'
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
                ? 'bg-orange-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900'
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
            }}
            className={`min-h-[34px] px-3 py-1.5 rounded font-medium transition flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer ${
              period === 'custom'
                ? 'bg-orange-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Pilih Tanggal</span>
          </button>
        </div>
      </div>

      {/* 2. Sub-Filters: Berdasarkan Bulan */}
      {period === 'bulan' && (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3 sm:p-3.5 space-y-2.5 w-full min-w-0 overflow-hidden animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
              <div className="min-w-0">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(Number(e.target.value))}
                  className="w-full min-w-0 bg-white border border-slate-200 text-xs font-bold px-2.5 py-2 rounded-xl text-slate-800 outline-none focus:border-[#FF6038]"
                >
                  {BULAN_NAMES.map((bName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {bName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tahun</label>
                <select
                  value={selectedYear}
                  onChange={(e) => onYearChange(Number(e.target.value))}
                  className="w-full min-w-0 bg-white border border-slate-200 text-xs font-bold px-2.5 py-2 rounded-xl text-slate-800 outline-none focus:border-[#FF6038]"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toggle View Mode: Harian di Bulan Ini vs Tren 12 Bulan */}
            <div className="grid grid-cols-2 gap-1 bg-white/90 p-1 rounded-xl border border-orange-200/60 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onMonthViewModeChange('daily')}
                className={`px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition text-center truncate ${
                  monthViewMode === 'daily'
                    ? 'bg-[#FF6038] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Harian {BULAN_NAMES[selectedMonth - 1].slice(0, 3)}
              </button>
              <button
                type="button"
                onClick={() => onMonthViewModeChange('yearly')}
                className={`px-2 py-1.5 text-[10px] sm:text-[11px] font-bold rounded-lg transition text-center truncate ${
                  monthViewMode === 'yearly'
                    ? 'bg-[#FF6038] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tren 12 Bulan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2b. Sub-Filters: Rentang Tanggal (Phone Friendly - Anti Keluar Box) */}
      {period === 'custom' && (
        <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-3 sm:p-3.5 space-y-2 w-full min-w-0 overflow-hidden animate-in fade-in">
          <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
            <Calendar className="w-4 h-4 text-[#FF6038] shrink-0" />
            <span>Pilih Rentang Tanggal:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
            <div className="min-w-0">
              <label className="text-[10px] font-semibold text-slate-500 block mb-1 truncate">Dari Tanggal</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="w-full min-w-0 max-w-full min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-white rounded-xl border border-slate-200 outline-none focus:border-[#FF6038] text-slate-800 box-border"
              />
            </div>
            <div className="min-w-0">
              <label className="text-[10px] font-semibold text-slate-500 block mb-1 truncate">Sampai Tanggal</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => onCustomEndDateChange(e.target.value)}
                className="w-full min-w-0 max-w-full min-h-[40px] px-2 py-1.5 text-[11px] sm:text-xs font-bold bg-white rounded-xl border border-slate-200 outline-none focus:border-[#FF6038] text-slate-800 box-border"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Metrics Summary for Filtered Period & Line Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Quick summary metrics */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="px-2.5 py-1.5 rounded-xl bg-orange-50/80 border border-orange-100 flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6038]" />
            <span className="text-slate-600 font-medium">Omzet:</span>
            <span className="font-extrabold text-slate-900">{formatRupiah(totalOmzet)}</span>
          </div>

          <div className="px-2.5 py-1.5 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center gap-1.5 sm:gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-600 font-medium">Laba:</span>
            <span className={`font-extrabold ${totalLaba >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {formatRupiah(totalLaba)}
            </span>
          </div>

          <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-semibold">
            <span>{totalTx} Pesanan</span>
            <span className="mx-1 text-slate-300">·</span>
            <span>Rata-rata: {formatRupiah(avgOmzetPerDay)}/hari</span>
          </div>
        </div>

        {/* Line Display Toggles */}
        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <button
            type="button"
            onClick={() => setShowSales(!showSales)}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border transition active:scale-95 ${
              showSales
                ? 'bg-[#FF6038]/10 text-[#FF6038] border-[#FF6038]/30 shadow-2xs'
                : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6038]" />
            <span>Omzet</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProfit(!showProfit)}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 border transition active:scale-95 ${
              showProfit
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Laba Bersih</span>
          </button>
        </div>
      </div>

      {/* 4. Interactive SVG Line Chart */}
      <div className="relative w-full overflow-hidden select-none">
        {isLoading ? (
          <div className="h-72 flex items-center justify-center text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-2xl">
            Memuat data grafik garis...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-72 flex items-center justify-center text-xs font-semibold text-slate-400 bg-slate-50/50 rounded-2xl">
            Tidak ada data transaksi pada rentang periode ini.
          </div>
        ) : (
          <div className="w-full overflow-x-auto no-scrollbar">
            <div className="min-w-[600px] sm:min-w-full">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-64 sm:h-72 overflow-visible"
              >
                <defs>
                  {/* Gradient for Sales (Orange) */}
                  <linearGradient id={`salesGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6038" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#FF6038" stopOpacity="0.0" />
                  </linearGradient>

                  {/* Gradient for Profit (Emerald) */}
                  <linearGradient id={`profitGrad_${uid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
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
                      stroke="#E2E8F0"
                      strokeWidth="1"
                      strokeDasharray={i === 0 ? 'none' : '4 4'}
                    />
                    <text
                      x={padLeft - 10}
                      y={tick.y + 4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#94A3B8"
                    >
                      {formatRupiah(tick.val)}
                    </text>
                  </g>
                ))}

                {/* Sales Area & Line */}
                {showSales && salesArea && (
                  <path d={salesArea} fill={`url(#salesGrad_${uid})`} />
                )}
                {showSales && salesPath && (
                  <path
                    d={salesPath}
                    fill="none"
                    stroke="#FF6038"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Profit Area & Line */}
                {showProfit && profitArea && (
                  <path d={profitArea} fill={`url(#profitGrad_${uid})`} />
                )}
                {showProfit && profitPath && (
                  <path
                    d={profitPath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
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
                    stroke="#0F172A"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    className="opacity-50"
                  />
                )}

                {/* Data Points (Dots) for Sales */}
                {showSales &&
                  salesPoints.map((pt, idx) => {
                    const isSelected = activeIdx === idx;
                    return (
                      <g key={`sales-pt-${idx}`} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6.5 : chartData.length > 20 ? 3 : 4}
                          fill="#FF6038"
                          stroke="#FFFFFF"
                          strokeWidth={isSelected ? 3 : 2}
                          className="transition-all duration-150"
                          onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                        />
                      </g>
                    );
                  })}

                {/* Data Points (Dots) for Profit */}
                {showProfit &&
                  profitPoints.map((pt, idx) => {
                    const isSelected = activeIdx === idx;
                    return (
                      <g key={`profit-pt-${idx}`} className="cursor-pointer">
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : chartData.length > 20 ? 2.5 : 3.5}
                          fill="#10B981"
                          stroke="#FFFFFF"
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="transition-all duration-150"
                          onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
                        />
                      </g>
                    );
                  })}

                {/* FLOATING NUMBER BADGES (Muncul Angka Saat Dipencet / Ditekan / Hover) */}
                {activeIdx !== null && chartData[activeIdx] && (
                  <>
                    {/* Badge 1: Sales / Omzet Number Badge */}
                    {showSales && ptSales && (
                      <g className="transition-all duration-200 pointer-events-none animate-in fade-in zoom-in-95">
                        {/* Halo glow pulse */}
                        <circle
                          cx={ptSales.x}
                          cy={ptSales.y}
                          r="12"
                          fill="#FF6038"
                          fillOpacity="0.25"
                        />
                        <circle
                          cx={ptSales.x}
                          cy={ptSales.y}
                          r="6.5"
                          fill="#FF6038"
                          stroke="#FFFFFF"
                          strokeWidth="3"
                        />

                        {/* Speech Bubble Badge with exact Rupiah number */}
                        <g transform={`translate(${clampedSalesX}, ${Math.max(26, ptSales.y - 28)})`}>
                          <polygon
                            points="-5,0 5,0 0,6"
                            fill="#FF6038"
                            transform={`translate(${ptSales.x - clampedSalesX}, 0)`}
                          />
                          <rect
                            x={-badgeHalf}
                            y="-22"
                            width={badgeWidth}
                            height="22"
                            rx="11"
                            fill="#FF6038"
                            filter="drop-shadow(0 3px 6px rgba(255,96,56,0.35))"
                          />
                          <text
                            x="0"
                            y="-7.5"
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="900"
                            fill="#FFFFFF"
                            letterSpacing="-0.2"
                          >
                            {formatRupiah(chartData[activeIdx].penjualan)}
                          </text>
                        </g>
                      </g>
                    )}

                    {/* Badge 2: Profit / Laba Number Badge */}
                    {showProfit && ptProfit && (
                      <g className="transition-all duration-200 pointer-events-none animate-in fade-in zoom-in-95">
                        <circle
                          cx={ptProfit.x}
                          cy={ptProfit.y}
                          r="11"
                          fill="#10B981"
                          fillOpacity="0.25"
                        />
                        <circle
                          cx={ptProfit.x}
                          cy={ptProfit.y}
                          r="6"
                          fill="#10B981"
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                        />

                        {(() => {
                          const isCloseToSales = ptSales && Math.abs(ptSales.y - ptProfit.y) < 32;
                          const profitBadgeY = isCloseToSales
                            ? Math.min(baselineY - 10, ptProfit.y + 28)
                            : Math.max(26, ptProfit.y - 28);
                          const pointerDown = !isCloseToSales;

                          return (
                            <g transform={`translate(${clampedProfitX}, ${profitBadgeY})`}>
                              <polygon
                                points={pointerDown ? "-5,0 5,0 0,6" : "-5,0 5,0 0,-6"}
                                fill="#10B981"
                                transform={`translate(${ptProfit.x - clampedProfitX}, ${pointerDown ? 0 : -22})`}
                              />
                              <rect
                                x={-badgeHalf}
                                y="-22"
                                width={badgeWidth}
                                height="22"
                                rx="11"
                                fill="#10B981"
                                filter="drop-shadow(0 3px 6px rgba(16,185,129,0.35))"
                              />
                              <text
                                x="0"
                                y="-7.5"
                                textAnchor="middle"
                                fontSize="10.5"
                                fontWeight="900"
                                fill="#FFFFFF"
                                letterSpacing="-0.2"
                              >
                                {formatRupiah(chartData[activeIdx].labaBersih)}
                              </text>
                            </g>
                          );
                        })()}
                      </g>
                    )}
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
                      fill={isSelected ? '#FF6038' : '#64748B'}
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
          </div>
        )}
      </div>

      {/* 5. Tooltip Card / Detail Preview */}
      <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
        {currentHovered ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-slate-500 text-[11px] font-semibold">Tanggal:</span>
              <div className="font-extrabold text-slate-900">
                {currentHovered.tanggal.length === 7
                  ? currentHovered.label
                  : formatDateIndo(currentHovered.tanggal)}
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] font-semibold">
                Penjualan ({currentHovered.totalTransaksi} tx):
              </span>
              <div className="font-black text-[#FF6038]">
                {formatRupiah(currentHovered.penjualan)}
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] font-semibold">Bahan Baku + Ops:</span>
              <div className="font-bold text-slate-700">
                {formatRupiah(currentHovered.biayaBahan + currentHovered.biayaOperasional)}
              </div>
            </div>

            <div>
              <span className="text-slate-500 text-[11px] font-semibold">Laba Bersih:</span>
              <div
                className={`font-black flex items-center gap-1 ${
                  currentHovered.labaBersih >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {currentHovered.labaBersih >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>{formatRupiah(currentHovered.labaBersih)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 flex items-center justify-center gap-1.5 py-1">
            <Info className="w-3.5 h-3.5 text-orange-600" />
            <span>Arahkan kursor atau ketuk titik bulatan grafik untuk melihat detail nominal.</span>
          </div>
        )}
      </div>
    </div>
  );
};

