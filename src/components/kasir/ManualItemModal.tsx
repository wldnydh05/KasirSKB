/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Plus, PackagePlus } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';

interface ManualItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManualItemModal: React.FC<ManualItemModalProps> = ({ isOpen, onClose }) => {
  const { addManualItem } = useCart();
  const { showToast } = useToast();

  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [harga, setHarga] = useState('');
  const [quantity, setQuantity] = useState('1');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      showToast('Nama produk wajib diisi', 'error');
      return;
    }

    const parsedHarga = Number(harga);
    if (isNaN(parsedHarga) || parsedHarga <= 0) {
      showToast('Harga harus berupa angka lebih besar dari 0', 'error');
      return;
    }

    const parsedQty = Math.max(1, parseInt(quantity) || 1);

    addManualItem(nama.trim(), parsedHarga, parsedQty, kode.trim() || undefined);
    showToast(`"${nama}" ditambahkan ke keranjang`, 'success');

    // Reset and close
    setNama('');
    setKode('');
    setHarga('');
    setQuantity('1');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-[#FF6038]" />
            <h3 className="font-bold text-slate-900 text-sm">Transaksi Tambahan (Manual)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Nama Produk / Item <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Kerupuk Kaleng / Telur Dadar"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Kode Produk (Opsional)
            </label>
            <input
              type="text"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              placeholder="Contoh: KRP-01"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Harga (Rp) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="100"
                step="100"
                value={harga}
                onChange={(e) => setHarga(e.target.value)}
                placeholder="2000"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Quantity <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#FF6038]/30 focus:border-[#FF6038] outline-none"
              />
            </div>
          </div>

          <div className="pt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="py-2.5 px-3 rounded-xl bg-[#FF6038] hover:bg-[#E04620] text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
