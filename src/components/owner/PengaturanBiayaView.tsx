/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, Save, Calculator, Plus, Trash2, BarChart2, AlertCircle, CheckCircle } from 'lucide-react';
import {
  menuService,
  biayaService,
  getFormattedDate,
} from '../../lib/supabaseService';
import type { Menu, BiayaRincianItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';
import { Spinner } from '../../components/ui/Spinner';

export const PengaturanBiayaView: React.FC = () => {
  const { showToast } = useToast();
  const { cabangList, selectedCabangFilter, setSelectedCabangFilter } = useCabang();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [rincian, setRincian] = useState<BiayaRincianItem[]>([]);
  // HPP per cabang per menu: { menuId: { "Cabang 1": 5000, "Cabang 2": 6000 } }
  const [bahanBakuInputs, setBahanBakuInputs] = useState<Record<number, Record<string, number>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(() => selectedCabangFilter || 'Semua');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [lastRefreshed, setLastRefreshed] = useState<number>(0);
  const rincianKeyRef = useRef<number>(0);

  // Force refresh when activeTab changes
  const triggerRefresh = useCallback(() => {
    setLastRefreshed(Date.now());
  }, []);

  // Load existing menu & latest daily operational cost
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const allMenus = (await menuService.getAll()).filter((m) => !m.deleted_at);
        setMenus(allMenus);

        const inputs: Record<number, Record<string, number>> = {};
        for (const m of allMenus) {
          if (m.id) {
            const perCabang = (m.biaya_per_cabang as Record<string, number>) || {};
            const withDefaults: Record<string, number> = {};
            cabangList.forEach((c) => {
              withDefaults[c] = perCabang[c] ?? m.biaya_bahan_baku ?? 0;
            });
            inputs[m.id] = withDefaults;
          }
        }
        setBahanBakuInputs(inputs);

        // Ambil biaya hari ini berdasarkan activeTab (single cabang)
        const today = getFormattedDate(new Date());
        let latestCost = null;

        if (activeTab !== 'Semua') {
          latestCost = await biayaService.getByDateAndCabang(today, activeTab);
        }

        if (latestCost) {
          if (latestCost.rincian && latestCost.rincian.length > 0) {
            setRincian(latestCost.rincian);
            rincianKeyRef.current = latestCost.rincian.length;
          } else {
            const totalLama =
              (latestCost.biaya_operasional || 0) + (latestCost.biaya_operasional_lainnya || 0);
            setRincian(totalLama > 0 ? [{ nama: 'Biaya Operasional Harian', biaya: totalLama }] : []);
            rincianKeyRef.current = totalLama > 0 ? 1 : 0;
          }
        } else {
          setRincian([]);
          rincianKeyRef.current = 0;
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [activeTab, cabangList, lastRefreshed]);

  // Sync activeTab with CabangContext filter
  useEffect(() => {
    setActiveTab(selectedCabangFilter || 'Semua');
  }, [selectedCabangFilter]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedCabangFilter(tab);
    setSaveStatus('idle');
    setSaveMessage('');
    triggerRefresh(); // Force refresh data when tab changes
  };

  const handleBahanChange = (menuId: number, cabang: string, val: string) => {
    // Allow empty input → treat as 0
    const num = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
    setBahanBakuInputs((prev) => ({
      ...prev,
      [menuId]: {
        ...(prev[menuId] || {}),
        [cabang]: num,
      },
    }));
  };

  // --- Rincian Biaya Operasional Harian ---
  const handleTambahRincian = () => {
    const newIdx = rincianKeyRef.current;
    rincianKeyRef.current = newIdx + 1;
    const newItem: BiayaRincianItem = { nama: '', biaya: 0 };
    setRincian((prev) => [...prev, newItem]);
    // Force re-render by updating key
  };

  const handleRincianNama = (idx: number, val: string) => {
    setRincian((prev) => prev.map((r, i) => (i === idx ? { ...r, nama: val } : r)));
  };

  const handleRincianBiaya = (idx: number, val: string) => {
    // Allow empty input → treat as 0
    const num = val === '' ? 0 : Math.max(0, parseInt(val) || 0);
    setRincian((prev) => prev.map((r, i) => (i === idx ? { ...r, biaya: num } : r)));
  };

  const handleHapusRincian = (idx: number) => {
    setRincian((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalOperasional = rincian.reduce((acc, r) => acc + (r.biaya || 0), 0);

  // Calculate metrics for active tab
  const getActiveTabMetrics = useCallback(() => {
    if (activeTab === 'Semua') {
      return { totalPenjualan: 0, totalHPP: 0, labaKotor: 0, labaBersih: 0 };
    }

    const filteredMenus = menus.filter((m) => 
      Array.isArray(m.cabang) && m.cabang.includes(activeTab)
    );

    let totalHPP = 0;
    let totalPenjualan = 0;

    filteredMenus.forEach((m) => {
      const perCabang = bahanBakuInputs[m.id!] || {};
      const hpp = perCabang[activeTab] ?? m.biaya_bahan_baku ?? 0;
      totalHPP += hpp;
      totalPenjualan += m.harga;
    });

    const labaKotor = totalPenjualan - totalHPP;
    const labaBersih = labaKotor - totalOperasional;

    return { totalPenjualan, totalHPP, labaKotor, labaBersih };
  }, [activeTab, menus, bahanBakuInputs, totalOperasional]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus('saving');
    setSaveMessage('Menyimpan...');

    const failedMenus: string[] = [];
    const today = getFormattedDate(new Date());

    try {
      // 1. SAVE BIAYA OPERASIONAL FIRST (critical path)
      if (activeTab !== 'Semua') {
        const rincianTersimpan = rincian
          .map((r) => ({ nama: r.nama.trim(), biaya: Math.max(0, r.biaya || 0) }))
          .filter((r) => r.nama.length > 0 || r.biaya > 0);
        const totalOps = rincianTersimpan.reduce((acc, r) => acc + r.biaya, 0);

        try {
          await biayaService.upsertByDateAndCabang(today, activeTab, {
            biaya_operasional: totalOps,
            biaya_operasional_lainnya: 0,
            rincian: rincianTersimpan,
            keterangan: rincianTersimpan.map((r) => `${r.nama} (${r.biaya})`).join(', '),
          });
          console.log('✅ Biaya operasional tersimpan:', { date: today, cabang: activeTab, totalOps });
        } catch (biayaErr: any) {
          console.error('❌ Gagal simpan biaya operasional:', biayaErr);
          throw new Error(`Gagal simpan biaya operasional: ${biayaErr?.message || biayaErr}`);
        }

        // Sync local state
        setRincian(rincianTersimpan);
        rincianKeyRef.current = rincianTersimpan.length;
      }

      // 2. SAVE HPP PER MENU FOR ACTIVE TAB
      if (activeTab !== 'Semua') {
        for (const [idStr, perCabang] of Object.entries(bahanBakuInputs)) {
          try {
            const menuId = Number(idStr);
            const hppValue = perCabang[activeTab] ?? 0;

            // Skip jika tidak ada perubahan HPP
            const existingMenu = menus.find((m) => m.id === menuId);
            const existingPerCabang = (existingMenu?.biaya_per_cabang as Record<string, number>) || {};
            const existingHpp = existingPerCabang[activeTab] ?? existingMenu?.biaya_bahan_baku ?? 0;
            if (existingHpp === hppValue) {
              continue; // Skip, tidak ada perubahan
            }

            // Hitung default HPP (rata-rata) untuk fallback biaya_bahan_baku
            const hppValues = Object.values(perCabang);
            const hppDefault = hppValues.length > 0
              ? Math.round(hppValues.reduce((a, b) => a + b, 0) / hppValues.length)
              : 0;

            await menuService.update(menuId, {
              biaya_bahan_baku: hppDefault,
              biaya_per_cabang: perCabang,
              updated_at: new Date().toISOString(),
            });
            console.log(`✅ HPP tersimpan untuk menu ${existingMenu?.nama || menuId}:`, perCabang);
          } catch (menuErr) {
            console.error('❌ Gagal update menu HPP:', idStr, menuErr);
            const menu = menus.find((m) => m.id === Number(idStr));
            if (menu) failedMenus.push(menu.nama);
          }
        }
      }

      // 3. SUCCESS HANDLING
      const successParts = [];
      if (activeTab !== 'Semua') {
        successParts.push('Biaya operasional tersimpan');
        successParts.push('HPP tersimpan');
      } else {
        successParts.push('HPP tersimpan (semua cabang)');
      }

      if (failedMenus.length > 0) {
        setSaveStatus('error');
        setSaveMessage(`⚠️ ${successParts.join(' & ')}, tapi gagal HPP: ${failedMenus.join(', ')}`);
        showToast(`HPP gagal untuk: ${failedMenus.join(', ')}`, 'error');
      } else {
        setSaveStatus('success');
        setSaveMessage(`✅ ${successParts.join(' & ')}!`);
        showToast(successParts.join(' & '), 'success');
      }

    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
      setSaveMessage('❌ Gagal menyimpan. Coba lagi.');
      showToast('Gagal menyimpan biaya operasional.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter menus for active tab
  const activeMenus = activeTab === 'Semua' 
    ? menus 
    : menus.filter((m) => Array.isArray(m.cabang) && m.cabang.includes(activeTab));

  const metrics = getActiveTabMetrics();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

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
            Kelola HPP per menu & biaya operasional harian per cabang
          </p>
        </div>
      </div>

      {/* Tab Navigation - seperti produk */}
      <div className="overflow-x-auto pb-2 mb-4 -mx-3 px-3 sm:mx-0 sm:px-0">
        <div className="flex gap-2 min-w-max">
          {['Semua', ...cabangList].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleTabChange(c)}
              className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all duration-200 whitespace-nowrap ${
                activeTab === c
                  ? 'bg-[var(--utama)] text-white shadow-[var(--utama)]/30'
                  : 'bg-[var(--kartu)] text-[var(--teks)] border border-[var(--garis)] hover:bg-[var(--latar)]'
              }`}
            >
              {c === 'Semua' ? '📋 Semua' : c}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Card for Active Tab */}
      {activeTab !== 'Semua' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[var(--kartu)] rounded-2xl p-4 border border-[var(--garis)]">
            <p className="text-[11px] text-[var(--redup)] uppercase tracking-wide">Total Jual</p>
            <p className="text-lg font-extrabold text-[var(--teks)] mt-1">{formatRupiah(metrics.totalPenjualan)}</p>
          </div>
          <div className="bg-[var(--kartu)] rounded-2xl p-4 border border-[var(--garis)]">
            <p className="text-[11px] text-[var(--redup)] uppercase tracking-wide">Total HPP</p>
            <p className="text-lg font-extrabold text-amber-600 mt-1">{formatRupiah(metrics.totalHPP)}</p>
          </div>
          <div className="bg-[var(--kartu)] rounded-2xl p-4 border border-[var(--garis)]">
            <p className="text-[11px] text-[var(--redup)] uppercase tracking-wide">Biaya Ops</p>
            <p className="text-lg font-extrabold text-orange-600 mt-1">{formatRupiah(totalOperasional)}</p>
          </div>
          <div className={`bg-[var(--kartu)] rounded-2xl p-4 border border-[var(--garis)] ${metrics.labaBersih >= 0 ? 'border-emerald-300' : 'border-rose-300'}`}>
            <p className="text-[11px] text-[var(--redup)] uppercase tracking-wide">Laba Bersih</p>
            <p className={`text-lg font-extrabold mt-1 ${metrics.labaBersih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatRupiah(metrics.labaBersih)}
            </p>
          </div>
        </div>
      )}

      {/* Save Status Banner */}
      {saveStatus !== 'idle' && (
        <div className={`mb-4 p-3 rounded-2xl flex items-center gap-2 text-sm font-medium ${
          saveStatus === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : saveStatus === 'error'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {saveStatus === 'success' && <CheckCircle className="w-5 h-5 shrink-0" />}
          {saveStatus === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
          {saveStatus === 'saving' && <Spinner size="sm" />}
          <span>{saveMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Menu HPP Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--kartu)] rounded-3xl border border-[var(--garis)]/90 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-[var(--garis)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--teks)] flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[var(--utama-teks)]" />
                <span>HPP per Menu — {activeTab === 'Semua' ? 'Semua Cabang' : activeTab}</span>
              </h3>
              <span className="text-xs text-[var(--redup)]">{activeMenus.length} Menu</span>
            </div>

            <div className="divide-y divide-[var(--garis)] max-h-[500px] overflow-y-auto">
              {activeMenus.length === 0 ? (
                <div className="p-8 text-center text-[var(--redup)]">
                  <p>Tidak ada menu di cabang ini.</p>
                  <p className="text-xs mt-1">Tambah menu di tab Produk dan pilih cabang ini.</p>
                </div>
              ) : (
                activeMenus.map((menu) => {
                  const perCabang = bahanBakuInputs[menu.id!] || {};
                  const currentHPP = perCabang[activeTab] ?? menu.biaya_bahan_baku ?? 0;
                  const margin = menu.harga - currentHPP;
                  const marginPct = menu.harga > 0 ? Math.round((margin / menu.harga) * 100) : 0;

                  return (
                    <div
                      key={menu.id}
                      className="p-3.5 sm:p-4 hover:bg-[var(--latar)]/70 transition"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <img
                          src={
                            menu.gambar_url ||
                            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'
                          }
                          alt={menu.nama}
                          className="w-11 h-11 rounded-xl object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs sm:text-sm text-[var(--teks)] truncate">
                            {menu.nama}
                          </div>
                          <div className="text-xs text-[var(--redup)] flex items-center gap-2 mt-0.5">
                            <span>Jual: {formatRupiah(menu.harga)}</span>
                            <span>·</span>
                            <span className={margin >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold>
                              Margin: {marginPct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {activeTab === 'Semua' ? (
                        // Show all cabang inputs - label sejajar input (row)
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {cabangList.map((c) => (
                            <div key={c} className="flex items-center gap-2 p-2 bg-[var(--latar)] rounded-xl border border-[var(--garis)]">
                              <label className="text-[10px] font-medium text-[var(--redup)] uppercase tracking-wide shrink-0 w-16">
                                {c}
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="500"
                                inputMode="numeric"
                                placeholder="0"
                                title="HPP untuk cabang ini. Kosong = 0."
                                value={perCabang[c] || ''}
                                onChange={(e) => handleBahanChange(menu.id!, c, e.target.value)}
                                className="flex-1 min-w-0 px-2.5 py-1.5 text-right font-bold text-xs rounded-lg border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--kartu)] focus:bg-[var(--kartu)]"
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Single cabang input - label sejajar input (row)
                        <div className="flex items-center gap-2 p-3 bg-[var(--latar)] rounded-xl border border-[var(--garis)]">
                          <label className="text-xs font-medium text-[var(--redup)] uppercase tracking-wide shrink-0">
                            HPP di {activeTab}
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="500"
                            inputMode="numeric"
                            placeholder="0"
                            title="Kosong = 0 jika bahan sudah include"
                            value={currentHPP || ''}
                            onChange={(e) => handleBahanChange(menu.id!, activeTab, e.target.value)}
                            className="flex-1 min-w-0 px-3 py-2 text-right font-bold text-sm rounded-lg border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)] bg-[var(--kartu)] focus:bg-[var(--kartu)]"
                          />
                          <span className="text-[10px] text-[var(--redup)] shrink-0 font-semibold">
                            {marginPct}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Operational Cost & Save */}
        <div className="space-y-4">
          {/* Operational Cost Card */}
          <div className="bg-[var(--kartu)] rounded-3xl p-5 border border-[var(--garis)]/90 shadow-2xs space-y-3 sticky top-24">
            <h3 className="font-bold text-sm text-[var(--teks)] flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--utama-teks)]" />
              <span>Biaya Operasional Harian {activeTab !== 'Semua' ? `— ${activeTab}` : ''}</span>
            </h3>
            <p className="text-xs text-[var(--redup)]">
              Catat kebutuhan harian: <strong>Nama Barang/Kebutuhan</strong> +{' '}
              <strong>Biaya</strong>. Contoh: Gas 3kg, Es batu, Air galon. Biaya boleh <strong>0</strong>.
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
                    title="Kosong = 0 jika biayanya sudah include"
                    value={item.biaya || ''}
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
              <div className="font-bold">Formula Laba Bersih:</div>
              <div>Laba = Total Penjualan - (Total HPP + Total Biaya Operasional Harian)</div>
            </div>
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 px-4 rounded-2xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] active:scale-[0.98] text-white text-xs font-bold transition shadow-md shadow-[var(--utama)]/20 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Menyimpan...' : 'Simpan Perhitungan Biaya'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};