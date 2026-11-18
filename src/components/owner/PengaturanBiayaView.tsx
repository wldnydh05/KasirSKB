/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Calculator, Plus, Trash2 } from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { Menu, BiayaRincianItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const PengaturanBiayaView: React.FC = () => {
  const { showToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [rincian, setRincian] = useState<BiayaRincianItem[]>([]);
  const [bahanBakuInputs, setBahanBakuInputs] = useState<Record<number, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load existing menu & latest daily operational cost
  useEffect(() => {
    async function loadData() {
      const allMenus = await db.menus.toArray();
      setMenus(allMenus);

      const inputs: Record<number, number> = {};
      for (const m of allMenus) {
        if (m.id) {
          inputs[m.id] = m.biaya_bahan_baku || 0;
        }
      }
      setBahanBakuInputs(inputs);

      // Ambil biaya hari ini (yang akan ditimpa saat simpan). Jika hari ini belum
      // ada record, pakai record dengan tanggal terbaru sebagai nilai awal.
      // Catatan: jangan pakai db.biaya.reverse().first() — itu id terbesar, dan id
      // terbesar bisa jadi tanggal lama (data historis ditambahkan belakangan),
      // sehingga nilai 0 yang baru disimpan seolah-olah tidak tersimpan.
      const today = getFormattedDate(new Date());
      const latestCost =
        (await db.biaya.where('tanggal').equals(today).first()) ??
        (await db.biaya.orderBy('tanggal').last());
      if (latestCost) {
        if (latestCost.rincian && latestCost.rincian.length > 0) {
          setRincian(latestCost.rincian);
        } else {
          // Data lama (belum berformat rincian) → tampilkan sebagai satu baris
          const totalLama =
            (latestCost.biaya_operasional || 0) + (latestCost.biaya_operasional_lainnya || 0);
          setRincian(totalLama > 0 ? [{ nama: 'Biaya Operasional Harian', biaya: totalLama }] : []);
        }
      }
    }

    loadData();
  }, []);

  const handleBahanChange = (menuId: number, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setBahanBakuInputs((prev) => ({
      ...prev,
      [menuId]: num,
    }));
  };

  // --- Rincian Biaya Operasional Harian (Nama Barang/Kebutuhan + Biaya) ---
  const handleTambahRincian = () => {
    setRincian((prev) => [...prev, { nama: '', biaya: 0 }]);
  };

  const handleRincianNama = (idx: number, val: string) => {
    setRincian((prev) => prev.map((r, i) => (i === idx ? { ...r, nama: val } : r)));
  };

  const handleRincianBiaya = (idx: number, val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setRincian((prev) => prev.map((r, i) => (i === idx ? { ...r, biaya: num } : r)));
  };

  const handleHapusRincian = (idx: number) => {
    setRincian((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalOperasional = rincian.reduce((acc, r) => acc + (r.biaya || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // 1. Update each menu's biaya_bahan_baku in IndexedDB
      for (const [idStr, cost] of Object.entries(bahanBakuInputs)) {
        await db.menus.update(Number(idStr), {
          biaya_bahan_baku: cost,
          updated_at: new Date().toISOString(),
        });
      }

      // 2. Save today's operational cost (format rincian: Nama Barang/Kebutuhan + Biaya)
      const rincianTersimpan = rincian
        .map((r) => ({ nama: r.nama.trim(), biaya: Math.max(0, r.biaya || 0) }))
        .filter((r) => r.nama.length > 0 || r.biaya > 0);
      const totalOps = rincianTersimpan.reduce((acc, r) => acc + r.biaya, 0);

      const today = getFormattedDate(new Date());
      const existingToday = await db.biaya.where('tanggal').equals(today).first();

      if (existingToday && existingToday.id) {
        await db.biaya.update(existingToday.id, {
          biaya_operasional: totalOps,
          biaya_operasional_lainnya: 0,
          rincian: rincianTersimpan,
          keterangan: rincianTersimpan.map((r) => `${r.nama} (${r.biaya})`).join(', '),
        });
      } else {
        await db.biaya.add({
          tanggal: today,
          biaya_operasional: totalOps,
          biaya_operasional_lainnya: 0,
          rincian: rincianTersimpan,
          keterangan: rincianTersimpan.map((r) => `${r.nama} (${r.biaya})`).join(', '),
          created_at: new Date().toISOString(),
        });
      }

      // Sinkronkan state lokal supaya baris kosong langsung hilang
      setRincian(rincianTersimpan);

      showToast('Komponen biaya dan kalkulasi laba/rugi berhasil disimpan!', 'success');
    } catch (err) {
      console.error('Failed to save costs:', err);
      showToast('Gagal menyimpan biaya.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate live preview metrics
  const avgSellingPrice =
    menus.length > 0
      ? menus.reduce((acc, m) => acc + m.harga, 0) / menus.length
      : 0;

  const avgCostOfGoods =
    menus.length > 0
      ? Object.values(bahanBakuInputs).reduce((acc, v) => acc + v, 0) / menus.length
      : 0;

  const avgGrossMarginPct =
    avgSellingPrice > 0 ? ((avgSellingPrice - avgCostOfGoods) / avgSellingPrice) * 100 : 0;

  return (
    <div className="pb-24 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--teks)] tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-[var(--utama-teks)]" />
            <span>Pengaturan Biaya & Laba/Rugi</span>
          </h2>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            Atur estimasi modal bahan baku per menu (boleh 0) & rincian biaya operasional harian
            per barang/kebutuhan untuk perhitungan laba akurat.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Menu Raw Material Costs Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--kartu)] rounded-3xl border border-[var(--garis)]/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[var(--garis)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--teks)]">
                Harga Bahan Baku per Porsi ({menus.length} Menu)
              </h3>
              <span className="text-xs text-[var(--redup)]">Modal Pokok (HPP)</span>
            </div>

            <div className="divide-y divide-[var(--garis)] max-h-[500px] overflow-y-auto">
              {menus.map((menu) => {
                const currentCost = bahanBakuInputs[menu.id!] ?? menu.biaya_bahan_baku ?? 0;
                const margin = menu.harga - currentCost;
                const marginPct = menu.harga > 0 ? Math.round((margin / menu.harga) * 100) : 0;

                return (
                  <div
                    key={menu.id}
                    className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--latar)]/70 transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          menu.gambar_url ||
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'
                        }
                        alt={menu.nama}
                        className="w-11 h-11 rounded-xl object-cover shrink-0"
                      />
                      <div>
                        <div className="font-bold text-xs sm:text-sm text-[var(--teks)]">
                          {menu.nama}
                        </div>
                        <div className="text-xs text-[var(--redup)] flex items-center gap-2 mt-0.5">
                          <span>Jual: {formatRupiah(menu.harga)}</span>
                          <span>·</span>
                          <span className="text-emerald-600 font-semibold">
                            Margin: {marginPct}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-xs text-[var(--redup)] font-medium">Bahan: Rp</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="numeric"
                        placeholder="0"
                        title="Boleh 0 jika biaya bahan sudah include/tidak dihitung terpisah"
                        value={currentCost}
                        onChange={(e) => handleBahanChange(menu.id!, e.target.value)}
                        className="w-28 px-2.5 py-1.5 text-right font-bold text-xs rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--latar)] focus:bg-[var(--kartu)]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Operational Cost & Live Profit Preview */}
        <div className="space-y-4">
          {/* Operational Cost Card */}
          <div className="bg-[var(--kartu)] rounded-3xl p-5 border border-[var(--garis)]/90 shadow-2xs space-y-3">
            <h3 className="font-bold text-sm text-[var(--teks)] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--utama-teks)]" />
              <span>Biaya Operasional Harian</span>
            </h3>
            <p className="text-xs text-[var(--redup)]">
              Catat kebutuhan harian satu per satu — format <strong>Nama Barang/Kebutuhan</strong> +{' '}
              <strong>Biaya</strong>. Contoh: Gas 3kg, Es batu, Sambel (jika terpisah dari porsi
              makan), Air galon, dll. Biaya boleh <strong>0</strong>.
            </p>

            {/* Header kolom */}
            <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--redup)] uppercase tracking-wide">
              <span className="flex-1 min-w-0">Nama Barang / Kebutuhan</span>
              <span className="w-24 text-right">Biaya (Rp)</span>
              <span className="w-6" />
            </div>

            {/* Daftar item */}
            <div className="space-y-2">
              {rincian.length === 0 && (
                <p className="text-xs text-[var(--redup)] italic">
                  Belum ada data. Klik "Tambah Item" untuk memasukkan biaya operasional hari ini.
                </p>
              )}

              {rincian.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={item.nama}
                    onChange={(e) => handleRincianNama(idx, e.target.value)}
                    placeholder="Nama barang/kebutuhan"
                    className="flex-1 min-w-0 px-3 py-2 text-xs font-semibold text-[var(--teks)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--latar)] focus:bg-[var(--kartu)]"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    inputMode="numeric"
                    placeholder="0"
                    title="Boleh 0 jika biayanya sudah include"
                    value={item.biaya}
                    onChange={(e) => handleRincianBiaya(idx, e.target.value)}
                    className="w-24 px-2.5 py-2 text-right text-xs font-bold text-[var(--teks)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--latar)] focus:bg-[var(--kartu)]"
                  />
                  <button
                    type="button"
                    onClick={() => handleHapusRincian(idx)}
                    aria-label={`Hapus ${item.nama || 'item'}`}
                    className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--redup)] hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleTambahRincian}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[var(--garis-kuat)] text-xs font-bold text-[var(--utama-teks)] hover:bg-[var(--utama-muda)]/70 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Item</span>
            </button>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--latar)] border border-[var(--garis)]">
              <span className="text-xs font-semibold text-[var(--redup)]">Total Operasional / Hari</span>
              <span className="text-sm font-extrabold text-[var(--teks)]">
                {formatRupiah(totalOperasional)}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[var(--utama-muda)]/70 border border-[var(--garis)] text-[11px] text-[var(--utama-teks)] space-y-1">
              <div className="font-bold">Formula Laba Bersih S.K.B:</div>
              <div>Laba = Total Penjualan - (Total Bahan Baku + Total Biaya Operasional Harian)</div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full mt-3 py-3 px-4 rounded-2xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-[var(--utama)]/20 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perhitungan Biaya'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

