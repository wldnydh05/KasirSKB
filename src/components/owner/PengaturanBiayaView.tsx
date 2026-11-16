/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DollarSign, Save, Calculator, HelpCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { db, getFormattedDate } from '../../db';
import type { Menu } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

export const PengaturanBiayaView: React.FC = () => {
  const { showToast } = useToast();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [biayaOperasionalHarian, setBiayaOperasionalHarian] = useState<number>(150000);
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

      // Fetch today's or latest operational cost
      const latestCost = await db.biaya.reverse().first();
      if (latestCost) {
        setBiayaOperasionalHarian(latestCost.biaya_operasional);
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

      // 2. Save today's operational cost
      const today = getFormattedDate(new Date());
      const existingToday = await db.biaya.where('tanggal').equals(today).first();

      if (existingToday && existingToday.id) {
        await db.biaya.update(existingToday.id, {
          biaya_operasional: biayaOperasionalHarian,
        });
      } else {
        await db.biaya.add({
          tanggal: today,
          biaya_operasional: biayaOperasionalHarian,
          keterangan: 'Biaya operasional harian (listrik, gas, sewa)',
          created_at: new Date().toISOString(),
        });
      }

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
            Atur estimasi modal bahan baku per menu & biaya operasional untuk perhitungan laba akurat.
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
                        step="500"
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
              Biaya tetap harian seperti listrik, gas, sewa tempat, air, dan kebersihan.
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--redup)] mb-1">
                Nominal per Hari (Rp)
              </label>
              <input
                type="number"
                min="0"
                step="5000"
                value={biayaOperasionalHarian}
                onChange={(e) => setBiayaOperasionalHarian(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 text-base font-extrabold text-[var(--teks)] rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)]"
              />
            </div>

            <div className="p-3 rounded-2xl bg-[var(--utama-muda)]/70 border border-[var(--garis)] text-[11px] text-[var(--utama-teks)] space-y-1">
              <div className="font-bold">Formula Laba Bersih S.K.B:</div>
              <div>Laba = Total Penjualan - (Total Bahan Baku + Biaya Operasional)</div>
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

