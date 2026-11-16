/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Eye,
  CheckCircle2,
  FileText,
  Clock,
  Store,
} from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { Transaksi, DetailTransaksi } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';

interface ExportRow {
  tanggal: string;
  waktu: string;
  cabang: string;
  id_transaksi: number;
  nama_item: string;
  jumlah: number;
  harga_satuan: number;
  subtotal: number;
  total_transaksi: number;
  metode_pembayaran: string;
  kasir: string;
}

export const EksporDataView: React.FC = () => {
  const { showToast } = useToast();
  const { selectedCabangFilter, setSelectedCabangFilter, cabangList } = useCabang();

  const today = new Date();
  const past30 = new Date(today);
  past30.setDate(today.getDate() - 30);

  const [startDate, setStartDate] = useState(getFormattedDate(past30));
  const [endDate, setEndDate] = useState(getFormattedDate(today));

  const [previewRows, setPreviewRows] = useState<ExportRow[]>([]);
  const [totalOmzet, setTotalOmzet] = useState(0);
  const [totalTxCount, setTotalTxCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data matching current date range & branch filter
  const loadData = async () => {
    setIsLoading(true);
    try {
      let txList = await db.transaksi
        .where('tanggal')
        .between(startDate, endDate, true, true)
        .toArray();

      if (selectedCabangFilter !== 'Semua') {
        txList = txList.filter((tx) => (tx.cabang || 'Cabang 1') === selectedCabangFilter);
      }

      const txIds = txList.map((t) => t.id!).filter(Boolean);
      const details =
        txIds.length > 0
          ? await db.detail_transaksi.where('transaksi_id').anyOf(txIds).toArray()
          : [];

      // Map tx details
      const detailsByTxId: Record<number, DetailTransaksi[]> = {};
      for (const d of details) {
        if (!detailsByTxId[d.transaksi_id]) {
          detailsByTxId[d.transaksi_id] = [];
        }
        detailsByTxId[d.transaksi_id].push(d);
      }

      const rows: ExportRow[] = [];
      let sumOmzet = 0;

      for (const tx of txList) {
        sumOmzet += tx.total;
        const txItems = detailsByTxId[tx.id!] || [];
        const txCabang = tx.cabang || 'Cabang 1';

        if (txItems.length === 0) {
          rows.push({
            tanggal: tx.tanggal,
            waktu: tx.waktu,
            cabang: txCabang,
            id_transaksi: tx.id!,
            nama_item: 'Pesanan Kasir',
            jumlah: 1,
            harga_satuan: tx.total,
            subtotal: tx.total,
            total_transaksi: tx.total,
            metode_pembayaran: tx.metode_pembayaran || 'Tunai',
            kasir: tx.user_name || 'Staff',
          });
        } else {
          for (const item of txItems) {
            rows.push({
              tanggal: tx.tanggal,
              waktu: tx.waktu,
              cabang: txCabang,
              id_transaksi: tx.id!,
              nama_item: item.nama_item,
              jumlah: item.jumlah,
              harga_satuan: item.harga_satuan,
              subtotal: item.subtotal,
              total_transaksi: tx.total,
              metode_pembayaran: tx.metode_pembayaran || 'Tunai',
              kasir: tx.user_name || 'Staff',
            });
          }
        }
      }

      setPreviewRows(rows);
      setTotalTxCount(txList.length);
      setTotalOmzet(sumOmzet);
    } catch (err) {
      console.error('Failed to load export data:', err);
      showToast('Gagal memuat data ekspor.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedCabangFilter]);

  const handleExportCSV = () => {
    if (previewRows.length === 0) {
      showToast('Tidak ada data transaksi pada rentang tanggal tersebut.', 'error');
      return;
    }

    // CSV header per PRD AC-13 & 14.1
    const headers = [
      'tanggal',
      'waktu',
      'cabang',
      'id_transaksi',
      'nama_item',
      'jumlah',
      'harga_satuan',
      'subtotal',
      'total_transaksi',
      'metode_pembayaran',
      'kasir',
    ];

    const escapeCsv = (str: string | number) => {
      const val = String(str).replace(/"/g, '""');
      return `"${val}"`;
    };

    const csvContentRows = previewRows.map((r) =>
      [
        r.tanggal,
        r.waktu,
        escapeCsv(r.cabang),
        r.id_transaksi,
        escapeCsv(r.nama_item),
        r.jumlah,
        r.harga_satuan,
        r.subtotal,
        r.total_transaksi,
        escapeCsv(r.metode_pembayaran),
        escapeCsv(r.kasir),
      ].join(',')
    );

    // Add UTF-8 BOM (\uFEFF) so Excel & Sheets render Indonesian special characters properly
    const fullCsv = '\uFEFF' + [headers.join(','), ...csvContentRows].join('\r\n');

    const blob = new Blob([fullCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const startStr = startDate.replace(/-/g, '');
    const endStr = endDate.replace(/-/g, '');
    const cabangSuffix = selectedCabangFilter === 'Semua' ? 'semua' : selectedCabangFilter.toLowerCase().replace(/\s+/g, '_');
    link.href = url;
    link.setAttribute('download', `transaksi_${cabangSuffix}_${startStr}_${endStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`File CSV ${selectedCabangFilter} siap diunduh dan dibuka di Excel/Sheets!`, 'success');
  };

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#FF6038]" />
            <span>Ekspor Data Transaksi (CSV)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Unduh laporan penjualan berformat CSV standar untuk diolah di Excel, Google Sheets, atau dikirim via WhatsApp.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          disabled={previewRows.length === 0}
          className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#FF6038] hover:bg-[#E04620] active:scale-95 text-white text-xs font-bold transition shadow-md shadow-orange-500/20 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>Unduh File CSV ({previewRows.length} Baris)</span>
        </button>
      </div>

      {/* Date Range Picker & Filter Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs mb-5">
        {/* Cabang Filter Pills */}
        <div className="mb-4 pb-3 border-b border-slate-100 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
            <Store className="w-4 h-4 text-[#FF6038]" />
            <span>Pilih Cabang:</span>
          </div>
          <button
            onClick={() => setSelectedCabangFilter('Semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCabangFilter === 'Semua'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Semua Cabang (Gabungan)
          </button>
          {cabangList.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCabangFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCabangFilter === c
                  ? 'bg-[#FF6038] text-white shadow-xs shadow-orange-500/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-3">
          Pilih Rentang Tanggal
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tanggal Mulai
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tanggal Selesai
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="lg:col-span-2 flex items-end gap-2 pb-0.5">
            <button
              onClick={() => {
                const t = new Date();
                setStartDate(getFormattedDate(t));
                setEndDate(getFormattedDate(t));
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Hari Ini
            </button>
            <button
              onClick={() => {
                const t = new Date();
                const p = new Date(t);
                p.setDate(t.getDate() - 7);
                setStartDate(getFormattedDate(p));
                setEndDate(getFormattedDate(t));
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              7 Hari
            </button>
            <button
              onClick={() => {
                const t = new Date();
                const p = new Date(t);
                p.setDate(t.getDate() - 30);
                setStartDate(getFormattedDate(p));
                setEndDate(getFormattedDate(t));
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              30 Hari
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-slate-100 text-center">
          <div className="p-2.5 rounded-2xl bg-slate-50">
            <div className="text-[11px] text-slate-500">Total Transaksi</div>
            <div className="text-base font-extrabold text-slate-900">{totalTxCount}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-slate-50">
            <div className="text-[11px] text-slate-500">Item Terjual (Baris)</div>
            <div className="text-base font-extrabold text-slate-900">{previewRows.length}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-orange-50/60 border border-orange-100">
            <div className="text-[11px] text-orange-800">Total Penjualan ({selectedCabangFilter})</div>
            <div className="text-base font-extrabold text-[#FF6038]">
              {formatRupiah(totalOmzet)}
            </div>
          </div>
        </div>
      </div>

      {/* CSV Preview Table */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
              Preview Data CSV ({selectedCabangFilter} - Maks. 50 Baris)
            </h4>
          </div>
          <span className="text-xs text-slate-400">Format: UTF-8 Comma Delimited</span>
        </div>

        {previewRows.length === 0 ? (
          <div className="text-center py-12 p-6 text-xs text-slate-400">
            Tidak ada transaksi pada rentang tanggal dan cabang ini.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-slate-50 border-b border-slate-200 font-mono text-slate-500 uppercase sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Waktu</th>
                  <th className="py-2.5 px-3">Cabang</th>
                  <th className="py-2.5 px-3">ID Tx</th>
                  <th className="py-2.5 px-3">Nama Menu</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Harga</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3">Metode</th>
                  <th className="py-2.5 px-3">Kasir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {previewRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-slate-700">{row.tanggal}</td>
                    <td className="py-2 px-3 text-slate-500">{row.waktu}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                        row.cabang === 'Cabang 1'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-indigo-100 text-indigo-900'
                      }`}>
                        {row.cabang}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-800 font-bold">#{row.id_transaksi}</td>
                    <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                      {row.nama_item}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{row.jumlah}</td>
                    <td className="py-2 px-3 text-right">{row.harga_satuan.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">
                      {row.subtotal.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">
                      {row.metode_pembayaran}
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-600">{row.kasir}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

