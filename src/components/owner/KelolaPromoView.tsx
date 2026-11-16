/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Calendar,
  AlertTriangle,
  Percent,
} from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { Promo } from '../../types';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { useCart } from '../../context/CartContext';

export const KelolaPromoView: React.FC = () => {
  const { showToast } = useToast();
  const { appliedPromo, setAppliedPromo } = useCart();

  const [promos, setPromos] = useState<Promo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);

  // Delete modal state
  const [promoToDelete, setPromoToDelete] = useState<Promo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [nama, setNama] = useState('');
  const [tipe, setTipe] = useState<'persen' | 'nominal'>('persen');
  const [nilai, setNilai] = useState('10');
  const [tanggalMulai, setTanggalMulai] = useState(getFormattedDate(new Date()));
  const [tanggalSelesai, setTanggalSelesai] = useState(
    getFormattedDate(new Date(Date.now() + 30 * 86400000))
  );
  const [aktif, setAktif] = useState(true);

  const loadPromos = async () => {
    try {
      const list = await db.promo.toArray();
      // Sort newest or by id descending
      list.sort((a, b) => (b.id || 0) - (a.id || 0));
      setPromos(list);
    } catch (err) {
      console.error('Failed to load promos:', err);
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const openAddModal = () => {
    setEditingPromo(null);
    setNama('');
    setTipe('persen');
    setNilai('10');
    setTanggalMulai(getFormattedDate(new Date()));
    setTanggalSelesai(getFormattedDate(new Date(Date.now() + 30 * 86400000)));
    setAktif(true);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Promo) => {
    setEditingPromo(p);
    setNama(p.nama);
    setTipe(p.tipe);
    setNilai(String(p.nilai));
    setTanggalMulai(p.tanggal_mulai);
    setTanggalSelesai(p.tanggal_selesai);
    setAktif(p.aktif);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      showToast('Nama promo wajib diisi', 'error');
      return;
    }

    const numNilai = Number(nilai);
    if (isNaN(numNilai) || numNilai <= 0) {
      showToast('Nilai promo harus lebih besar dari 0', 'error');
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      if (editingPromo && editingPromo.id) {
        await db.promo.update(editingPromo.id, {
          nama: nama.trim(),
          tipe,
          nilai: numNilai,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          aktif,
        });
        showToast(`Promo "${nama.trim()}" berhasil diperbarui!`, 'success');
      } else {
        await db.promo.add({
          nama: nama.trim(),
          tipe,
          nilai: numNilai,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: tanggalSelesai,
          aktif,
          created_at: nowIso,
        });
        showToast(`Promo "${nama.trim()}" berhasil ditambahkan!`, 'success');
      }

      setIsModalOpen(false);
      await loadPromos();
    } catch (err) {
      console.error('Failed to save promo:', err);
      showToast('Gagal menyimpan promo', 'error');
    }
  };

  const handleDeleteClick = (promo: Promo, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPromoToDelete(promo);
  };

  const handleConfirmDelete = async () => {
    if (!promoToDelete || !promoToDelete.id) return;
    setIsDeleting(true);
    try {
      const targetId = promoToDelete.id;
      const targetName = promoToDelete.nama;

      await db.promo.delete(targetId);

      // If this promo is currently active in the cart, remove it
      if (appliedPromo && appliedPromo.id === targetId) {
        setAppliedPromo(null);
      }

      showToast(`Promo "${targetName}" berhasil dihapus`, 'info');
      setPromoToDelete(null);

      // If edit modal was open with this promo, close it too
      if (editingPromo && editingPromo.id === targetId) {
        setIsModalOpen(false);
      }

      await loadPromos();
    } catch (err) {
      console.error('Failed to delete promo:', err);
      showToast('Gagal menghapus promo', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAktif = async (promo: Promo) => {
    if (!promo.id) return;
    try {
      const newStatus = !promo.aktif;
      await db.promo.update(promo.id, { aktif: newStatus });
      showToast(
        `Promo "${promo.nama}" ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`,
        'info'
      );
      await loadPromos();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--teks)] tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-[var(--utama-teks)]" />
            <span>Kelola Promo & Diskon</span>
          </h2>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Buat diskon persen atau potongan nominal untuk memikat pelanggan dan meningkatkan transaksi kasir.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-bold transition shadow-sm shadow-[var(--utama)]/20 active:scale-95 min-h-[40px]"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Promo Baru</span>
        </button>
      </div>

      {/* Promos Content */}
      {promos.length === 0 ? (
        <div className="text-center py-16 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-8">
          <div className="w-14 h-14 rounded-2xl bg-[var(--utama-muda)] text-[var(--utama-teks)] flex items-center justify-center mx-auto mb-3">
            <Tag className="w-7 h-7" />
          </div>
          <h4 className="text-sm font-bold text-[var(--teks)]">Belum ada promo</h4>
          <p className="text-xs text-[var(--redup)] mt-1 max-w-xs mx-auto">
            Klik tombol Tambah Promo Baru untuk membuat diskon kasir pertama Anda.
          </p>
          <button
            onClick={openAddModal}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--utama)] text-white text-xs font-bold hover:bg-[var(--utama-tua)] transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Promo</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Mobile View: Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
            {promos.map((p) => (
              <div
                key={p.id}
                className="bg-[var(--kartu)] rounded-2xl border border-[var(--garis)]/90 p-4 shadow-2xs flex flex-col justify-between gap-3 hover:border-[var(--garis-kuat)] transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-extrabold text-[var(--teks)] text-sm leading-snug">
                      {p.nama}
                    </h3>
                    <span
                      className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.aktif
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[var(--latar)] text-[var(--redup)] border border-[var(--garis)]'
                      }`}
                    >
                      {p.aktif ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs">
                      {p.tipe === 'persen' ? (
                        <>
                          <Percent className="w-3 h-3" />
                          <span>Diskon {p.nilai}%</span>
                        </>
                      ) : (
                        <span>Potongan {formatRupiah(p.nilai)}</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--redup)] mt-2.5">
                    <Calendar className="w-3.5 h-3.5 text-[var(--redup)] shrink-0" />
                    <span>
                      {formatDateIndo(p.tanggal_mulai)} s/d {formatDateIndo(p.tanggal_selesai)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--garis)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleAktif(p)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition min-h-[36px] ${
                      p.aktif
                        ? 'text-amber-700 hover:bg-amber-50'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    {p.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--garis)] text-[var(--teks)] hover:bg-[var(--latar)] text-xs font-semibold transition min-h-[36px] active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-[var(--redup)]" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteClick(p, e)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition min-h-[36px] active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop & Tablet Table View */}
          <div className="hidden lg:block bg-[var(--kartu)] rounded-3xl border border-[var(--garis)]/90 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--latar)] border-b border-[var(--garis)] text-[var(--redup)] uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Nama Promo</th>
                    <th className="py-3 px-4">Tipe & Nilai</th>
                    <th className="py-3 px-4">Periode Aktif</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--garis)]">
                  {promos.map((p) => (
                    <tr key={p.id} className="hover:bg-[var(--latar)]/70 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[var(--teks)] text-sm">{p.nama}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-purple-50 text-purple-700 font-extrabold text-xs">
                          {p.tipe === 'persen' ? `${p.nilai}%` : formatRupiah(p.nilai)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--redup)]">
                        {formatDateIndo(p.tanggal_mulai)} s/d {formatDateIndo(p.tanggal_selesai)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleAktif(p)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            p.aktif
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-[var(--garis)] text-[var(--redup)] hover:bg-[var(--garis-kuat)]'
                          }`}
                        >
                          {p.aktif ? 'Aktif' : 'Non-Aktif'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-2 text-[var(--redup)] hover:text-[var(--teks)] hover:bg-[var(--latar)] rounded-xl transition cursor-pointer"
                            title="Edit Promo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(p, e)}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                            title="Hapus Promo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {promoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl overflow-hidden border border-[var(--garis)] p-5 sm:p-6 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-[var(--teks)]">
              Hapus Promo Ini?
            </h3>

            <p className="text-xs text-[var(--redup)] mt-1.5 mb-5 leading-relaxed">
              Yakin ingin menghapus promo{' '}
              <span className="font-bold text-[var(--teks)]">
                "{promoToDelete.nama}"
              </span>
              ? Promo yang sudah dihapus tidak dapat dipulihkan dan tidak akan muncul lagi di kasir.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPromoToDelete(null)}
                className="w-full py-2.5 px-4 rounded-xl border border-[var(--garis)] text-xs font-bold text-[var(--teks)] hover:bg-[var(--latar)] transition active:scale-95 disabled:opacity-50 min-h-[44px]"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:brightness-90 text-xs font-bold text-white transition shadow-sm shadow-rose-600/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal CRUD Promo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-[var(--kartu)] shadow-2xl overflow-hidden border border-[var(--garis)] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 bg-[var(--latar)] border-b border-[var(--garis)]">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[var(--utama-teks)]" />
                <h3 className="font-bold text-[var(--teks)] text-sm">
                  {editingPromo ? 'Edit Promo' : 'Tambah Promo Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-[var(--redup)] hover:text-[var(--redup)] hover:bg-[var(--garis)]/50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                  Nama Promo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Diskon Jam Makan Siang 10%"
                  className="w-full px-3 py-2 text-sm border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                    Tipe Diskon
                  </label>
                  <select
                    value={tipe}
                    onChange={(e) => setTipe(e.target.value as 'persen' | 'nominal')}
                    className="w-full px-3 py-2 text-sm border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none bg-[var(--kartu)]"
                  >
                    <option value="persen">Persentase (%)</option>
                    <option value="nominal">Nominal Tunai (Rp)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                    Nilai ({tipe === 'persen' ? '%' : 'Rp'}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={nilai}
                    onChange={(e) => setNilai(e.target.value)}
                    placeholder={tipe === 'persen' ? '10' : '5000'}
                    className="w-full px-3 py-2 text-sm border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    required
                    value={tanggalSelesai}
                    onChange={(e) => setTanggalSelesai(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="promoAktif"
                  checked={aktif}
                  onChange={(e) => setAktif(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--utama-teks)] focus:ring-[var(--utama-teks)]"
                />
                <label htmlFor="promoAktif" className="text-xs font-semibold text-[var(--teks)] cursor-pointer">
                  Status Aktif (Tampilkan di Kasir)
                </label>
              </div>

              <div className="pt-3 border-t border-[var(--garis)]">
                {editingPromo && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromoToDelete(editingPromo);
                    }}
                    className="w-full mb-3 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Promo Ini</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-3 rounded-xl border border-[var(--garis)] text-xs font-semibold text-[var(--redup)] hover:bg-[var(--latar)] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-3 rounded-xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Simpan Promo</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

