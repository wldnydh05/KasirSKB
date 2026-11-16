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
  ChevronDown,
  X,
  File,
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
  const [showExportMenu, setShowExportMenu] = useState(false);

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

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-export-menu]')) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

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
    setShowExportMenu(false);
  };

  const handleExportXLSX = () => {
    if (previewRows.length === 0) {
      showToast('Tidak ada data transaksi pada rentang tanggal tersebut.', 'error');
      return;
    }

    // Create workbook using simple HTML table approach (Excel can open it)
    const headers = [
      'Tanggal',
      'Waktu',
      'Cabang',
      'ID Transaksi',
      'Nama Item',
      'Jumlah',
      'Harga Satuan',
      'Subtotal',
      'Total Transaksi',
      'Metode Pembayaran',
      'Kasir',
    ];

    const rows = previewRows.map((r) => [
      r.tanggal,
      r.waktu,
      r.cabang,
      r.id_transaksi,
      r.nama_item,
      r.jumlah,
      r.harga_satuan,
      r.subtotal,
      r.total_transaksi,
      r.metode_pembayaran,
      r.kasir,
    ]);

    // Build HTML table
    let html = '<table border="1">';
    html += '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
    for (const row of rows) {
      html += '<tr>' + row.map(c => `<td>${c}</td>`).join('') + '</tr>';
    }
    html += '</table>';

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    const startStr = startDate.replace(/-/g, '');
    const endStr = endDate.replace(/-/g, '');
    const cabangSuffix = selectedCabangFilter === 'Semua' ? 'semua' : selectedCabangFilter.toLowerCase().replace(/\s+/g, '_');
    link.href = url;
    link.setAttribute('download', `transaksi_${cabangSuffix}_${startStr}_${endStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`File Excel ${selectedCabangFilter} siap diunduh!`, 'success');
    setShowExportMenu(false);
  };

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--teks)] tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[var(--utama-teks)]" />
            <span>Ekspor Data Transaksi</span>
          </h2>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Unduh laporan penjualan berformat CSV atau XLS untuk diolah di Excel, Google Sheets, atau dikirim via WhatsApp.
          </p>
        </div>

        <div className="relative self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={previewRows.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-bold transition shadow-md shadow-[var(--utama)]/20 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Unduh Data ({previewRows.length} Baris)</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
          </button>
          {showExportMenu && (
            <div data-export-menu className="absolute bottom-full right-0 mb-2 z-10 animate-in fade-in-20 zoom-in-95">
              <div className="bg-[var(--kartu)] rounded-2xl border border-[var(--garis)] shadow-lg overflow-hidden min-w-[180px]">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-[var(--teks)] hover:bg-[var(--latar)] transition flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-green-600" />
                  <span>CSV (Excel/Sheets)</span>
                </button>
                <div className="border-t border-[var(--garis)]" />
                <button
                  type="button"
                  onClick={handleExportXLSX}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-[var(--teks)] hover:bg-[var(--latar)] transition flex items-center gap-2"
                >
                  <File className="w-4 h-4 text-green-600" />
                  <span>XLS (Excel 97-2003)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Date Range Picker & Filter Card */}
      <div className="bg-[var(--kartu)] rounded-3xl p-5 border border-[var(--garis)]/90 shadow-2xs mb-5">
        {/* Cabang Filter Pills */}
        <div className="mb-4 pb-3 border-b border-[var(--garis)] flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--teks)] mr-1">
            <Store className="w-4 h-4 text-[var(--utama-teks)]" />
            <span>Pilih Cabang:</span>
          </div>
          <button
            onClick={() => setSelectedCabangFilter('Semua')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              selectedCabangFilter === 'Semua'
                ? 'bg-[var(--utama)] text-white shadow-xs shadow-[var(--utama)]/20'
                : 'bg-[var(--latar)] text-[var(--teks)] hover:bg-[var(--garis)]'
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
                  ? 'bg-[var(--utama)] text-white shadow-xs shadow-[var(--utama)]/20'
                  : 'bg-[var(--latar)] text-[var(--teks)] hover:bg-[var(--garis)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <h3 className="font-bold text-xs text-[var(--teks)] uppercase tracking-wider mb-3">
          Pilih Rentang Tanggal
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
              Tanggal Mulai
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
              Tanggal Selesai
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-2 pt-4 mt-4 border-t border-[var(--garis)] text-center">
          <div className="p-2.5 rounded-2xl bg-[var(--latar)]">
            <div className="text-[11px] text-[var(--redup)]">Total Transaksi</div>
            <div className="text-base font-extrabold text-[var(--teks)]">{totalTxCount}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[var(--latar)]">
            <div className="text-[11px] text-[var(--redup)]">Item Terjual (Baris)</div>
            <div className="text-base font-extrabold text-[var(--teks)]">{previewRows.length}</div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[var(--utama-muda)]/60 border border-[var(--garis)]">
            <div className="text-[11px] text-[var(--utama-teks)]">Total Penjualan ({selectedCabangFilter})</div>
            <div className="text-base font-extrabold text-[var(--utama-teks)]">
              {formatRupiah(totalOmzet)}
            </div>
          </div>
        </div>
      </div>

      {/* CSV Preview Table */}
      <div className="bg-[var(--kartu)] rounded-3xl border border-[var(--garis)]/90 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[var(--garis)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[var(--redup)]" />
            <h4 className="font-bold text-xs text-[var(--teks)] uppercase tracking-wider">
              Preview Data CSV ({selectedCabangFilter} - Maks. 50 Baris)
            </h4>
          </div>
          <span className="text-xs text-[var(--redup)]">Format: UTF-8 Comma Delimited</span>
        </div>

        {previewRows.length === 0 ? (
          <div className="text-center py-12 p-6 text-xs text-[var(--redup)]">
            Tidak ada transaksi pada rentang tanggal dan cabang ini.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-[var(--latar)] border-b border-[var(--garis)] font-mono text-[var(--redup)] uppercase sticky top-0">
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
              <tbody className="divide-y divide-[var(--garis)] font-mono">
                {previewRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-[var(--latar)] transition">
                    <td className="py-2 px-3 text-[var(--teks)]">{row.tanggal}</td>
                    <td className="py-2 px-3 text-[var(--redup)]">{row.waktu}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                        row.cabang === 'Cabang 1'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-indigo-100 text-indigo-900'
                      }`}>
                        {row.cabang}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[var(--teks)] font-bold">#{row.id_transaksi}</td>
                    <td className="py-2 px-3 font-sans font-semibold text-[var(--teks)]">
                      {row.nama_item}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{row.jumlah}</td>
                    <td className="py-2 px-3 text-right">{row.harga_satuan.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-bold text-[var(--teks)]">
                      {row.subtotal.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-sans text-[var(--redup)]">
                      {row.metode_pembayaran}
                    </td>
                    <td className="py-2 px-3 font-sans text-[var(--redup)]">{row.kasir}</td>
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

