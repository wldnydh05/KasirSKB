/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle2, Printer, PlusCircle, X, Share2 } from 'lucide-react';
import type { Transaksi, DetailTransaksi } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi | null;
  items: DetailTransaksi[];
  onNewTransaction: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaksi,
  items,
  onNewTransaction,
}) => {
  if (!isOpen || !transaksi) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const orderIdentifier = transaksi.nomor_pesanan ? `#${transaksi.nomor_pesanan}` : `#${transaksi.id}`;
    const branchInfo = transaksi.cabang ? ` [${transaksi.cabang}]` : '';
    const tipeLayanan = transaksi.tipe_pesanan || (transaksi.nomor_meja ? 'Makan Di Tempat' : 'Bungkus');
    const custInfo = transaksi.nama_pelanggan
      ? ` | Pelanggan: ${transaksi.nama_pelanggan} (${tipeLayanan}${transaksi.nomor_meja ? ` Meja ${transaksi.nomor_meja}` : ''})`
      : ` | ${tipeLayanan}${transaksi.nomor_meja ? ` Meja ${transaksi.nomor_meja}` : ''}`;
    const shareText = `Struk ${orderIdentifier}${branchInfo}${custInfo} | ${formatDateIndo(transaksi.tanggal)} ${transaksi.waktu} | Total: ${formatRupiah(transaksi.total)} (${transaksi.metode_pembayaran || 'Lunas'}). Terima kasih telah berbelanja di BukuPOS!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Struk Transaksi ${orderIdentifier} - BukuPOS`,
          text: shareText,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-sm max-h-[92vh] rounded-3xl bg-white shadow-2xl flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 overflow-hidden my-auto">
        {/* Top Success Banner */}
        <div className="no-print bg-emerald-500 text-white p-4 sm:p-5 text-center relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 text-white/80 hover:text-white p-1 rounded-full transition hover:bg-white/10"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/20 mb-1.5">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-base sm:text-lg font-bold">
            {transaksi.nomor_pesanan ? `Struk Pesanan ${transaksi.nomor_pesanan}` : 'Struk Transaksi'}
          </h3>
          <p className="text-xs text-white/90">
            BukuPOS {transaksi.cabang ? `(${transaksi.cabang})` : ''} - Struk Resmi Pembayaran
          </p>
        </div>

        {/* Thermal Receipt Paper Styling (Scrollable Body) */}
        <div className="printable-receipt p-4 sm:p-5 font-mono text-xs text-slate-700 bg-white border-b-2 border-dashed border-slate-200 overflow-y-auto flex-1 overscroll-contain">
          <div className="text-center mb-3">
            <img
              src="/logo.png"
              alt="BukuPOS"
              className="h-10 mx-auto object-contain mb-1.5 grayscale contrast-125"
            />
            <h4 className="text-sm font-extrabold uppercase tracking-widest text-slate-900 font-sans">
              BukuPOS {transaksi.cabang ? `- ${transaksi.cabang}` : 'UMKM'}
            </h4>
            <p className="text-[10px] text-slate-500 font-sans">Jl. Kuliner Bahagia No. 12</p>
            <div className="my-2 border-b border-dashed border-slate-300" />
          </div>

          <div className="space-y-1 mb-3 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Cabang:</span>
              <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                {transaksi.cabang || 'Cabang 1'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">No. Nota / Pesanan:</span>
              <span className="font-bold text-slate-800">
                {transaksi.nomor_pesanan ? `#${transaksi.nomor_pesanan}` : `#${transaksi.id}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Penyajian:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                (transaksi.tipe_pesanan === 'Bungkus' || (!transaksi.tipe_pesanan && !transaksi.nomor_meja))
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}>
                {transaksi.tipe_pesanan || (transaksi.nomor_meja ? 'Makan Di Tempat' : 'Bungkus')}
              </span>
            </div>
            {transaksi.nama_pelanggan && (
              <div className="flex justify-between">
                <span className="text-slate-500">Pelanggan:</span>
                <span className="font-bold text-slate-900">{transaksi.nama_pelanggan}</span>
              </div>
            )}
            {transaksi.nomor_meja && (
              <div className="flex justify-between">
                <span className="text-slate-500">Meja:</span>
                <span className="font-semibold text-slate-800">{transaksi.nomor_meja}</span>
              </div>
            )}
            {transaksi.catatan && (
              <div className="flex justify-between text-[10px] text-amber-800 italic bg-amber-50 px-1.5 py-0.5 rounded">
                <span>Catatan:</span>
                <span>{transaksi.catatan}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Waktu:</span>
              <span>
                {formatDateIndo(transaksi.tanggal)} {transaksi.waktu}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Kasir:</span>
              <span>{transaksi.user_name || 'Staff'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Metode:</span>
              <span className="font-semibold text-slate-800">
                {transaksi.metode_pembayaran || 'Tunai'}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Items */}
          <div className="space-y-1.5 my-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-[11px]">
                <div className="max-w-[190px]">
                  <div className="font-semibold text-slate-800">{item.nama_item}</div>
                  <div className="text-[10px] text-slate-500">
                    {item.jumlah} x {formatRupiah(item.harga_satuan)}
                  </div>
                </div>
                <div className="font-bold text-slate-900">{formatRupiah(item.subtotal)}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-slate-300 my-2" />

          {/* Totals */}
          <div className="pt-1">
            <div className="flex justify-between text-sm font-black text-slate-900">
              <span>TOTAL</span>
              <span className="text-[#FF6038] text-base font-black">{formatRupiah(transaksi.total)}</span>
            </div>
          </div>

          <div className="my-3 text-center text-[10px] text-slate-400 font-sans">
            *** Terima Kasih Atas Kunjungan Anda ***
          </div>
        </div>

        {/* Action Buttons */}
        <div className="no-print p-3.5 sm:p-4 bg-slate-50 grid grid-cols-2 gap-2 shrink-0 border-t border-slate-100">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition active:scale-95 shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Cetak Struk</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition active:scale-95 shadow-2xs"
          >
            <Share2 className="w-4 h-4 text-slate-600" />
            <span>Bagikan</span>
          </button>
          <button
            onClick={onNewTransaction}
            className="col-span-2 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#FF6038] hover:bg-[#E04620] text-xs font-bold text-white transition shadow-sm active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Selesai / Transaksi Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
