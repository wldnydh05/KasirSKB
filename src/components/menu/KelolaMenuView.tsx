/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Search,
  Image as ImageIcon,
  ImageOff,
  Camera,
  Loader2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { menuService, kategoriService } from '../../lib/supabaseService';
import type { Menu, Kategori } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/Spinner';
import { useToast } from '../../context/ToastContext';
import { useCabang } from '../../context/CabangContext';
import { compressImageFile } from '../../utils/imageUtils';

export const KelolaMenuView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { cabangList, selectedCabangFilter, setSelectedCabangFilter } = useCabang();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.role === 'owner';

  const [menus, setMenus] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Kategori[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('Semua');
  const [selectedCabang, setSelectedCabang] = useState<'Semua' | string>('Semua');

  // Modal form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);

  // Delete Confirmation state
  const [menuToDelete, setMenuToDelete] = useState<Menu | null>(null);

  const [nama, setNama] = useState('');
  const [harga, setHarga] = useState('');
  const [kategori, setKategori] = useState('Makanan');
  const [gambarUrl, setGambarUrl] = useState('');
  const [aktif, setAktif] = useState(true);
  // Cabang tujuan menu — boleh lebih dari satu (Cabang 1 & Cabang 2) atau salah satu
  // Default diambil dari cabangList context (akan di-set ulang di openAddModal).
  // Hindari default 'Cabang 1' yang basi.
  const [cabangDipilih, setCabangDipilih] = useState<string[]>([]);
  // HPP per cabang: { "Cabang 1": 5000, "Cabang 2": 6000 }
  const [biayaPerCabang, setBiayaPerCabang] = useState<Record<string, number>>({});

  // Filter cabang yang valid — hanya cabang yang ada di cabangList
  const validCabangNames = cabangList.filter((c) => c && c.trim());
  const normalizeCabang = (cabangArr: string[] | undefined): string[] => {
    if (!Array.isArray(cabangArr)) return [];
    return cabangArr.filter((c) =>
      validCabangNames.some((valid) => String(valid ?? '').toLowerCase() === String(c ?? '').toLowerCase())
    );
  };
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cats, allMenus] = await Promise.all([
        kategoriService.getAll(),
        menuService.getAll(),
      ]);
      setCategories(cats);

      // Filter out soft-deleted
      const activeMenus = allMenus.filter((m) => !m.deleted_at);
      setMenus(activeMenus);
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingMenu(null);
    setNama('');
    setHarga('');
    setKategori('Makanan');
    setGambarUrl('');
    setAktif(true);
    // Default: cabang kosong (tidak memiliki cabang)
    setCabangDipilih([]);
    // Default HPP 0 per cabang
    const defaultHpp: Record<string, number> = {};
    cabangList.forEach((c) => { defaultHpp[c] = 0; });
    setBiayaPerCabang(defaultHpp);
    setIsModalOpen(true);
  };

  const openEditModal = (m: Menu) => {
    setEditingMenu(m);
    setNama(m.nama);
    setHarga(String(m.harga));
    setKategori(m.kategori);
    setGambarUrl(m.gambar_url || '');
    setAktif(m.aktif);
    const cabangLama = Array.isArray(m.cabang) ? m.cabang : [];
    // Filter hanya cabang yang valid (ada di cabangList) — cabang tidak valid jadi kosong
    const validCabang = normalizeCabang(cabangLama);
    setCabangDipilih(validCabang);
    // Load HPP per cabang from menu data
    const existingHpp = (m.biaya_per_cabang as Record<string, number>) || {};
    const loadedHpp: Record<string, number> = {};
    cabangList.forEach((c) => {
      loadedHpp[c] = existingHpp[c] ?? m.biaya_bahan_baku ?? 0;
    });
    setBiayaPerCabang(loadedHpp);
    setIsModalOpen(true);
  };

  const toggleCabangDipilih = (c: string) => {
    setCabangDipilih((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleLocalPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar yang valid (JPG, PNG, WebP)', 'error');
      return;
    }

    try {
      setIsProcessingPhoto(true);
      const compressedDataUrl = await compressImageFile(file, 600, 0.82);
      setGambarUrl(compressedDataUrl);
      showToast('Foto makanan dari penyimpanan lokal berhasil dipilih', 'success');
    } catch (err) {
      console.error('Failed to process image:', err);
      showToast('Gagal memuat foto dari perangkat', 'error');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setGambarUrl('');
    showToast('Foto menu dihapus (tampil sebagai tanpa foto)', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      showToast('Nama menu wajib diisi', 'error');
      return;
    }

    const numHarga = Number(harga);
    if (isNaN(numHarga) || numHarga <= 0) {
      showToast('Harga jual harus lebih besar dari 0', 'error');
      return;
    }

    // Cabang tidak wajib dipilih — kosong = tidak memiliki cabang

    // Validasi HPP per cabang
    for (const c of cabangDipilih) {
      const hpp = biayaPerCabang[c] ?? 0;
      if (hpp < 0) {
        showToast(`HPP untuk ${c} tidak boleh negatif`, 'error');
        return;
      }
    }

    setIsSaving(true);
    const nowIso = new Date().toISOString();
    const finalImage = gambarUrl.trim();

    // HPP default (fallback untuk cabang yg tidak punya entry) = rata-rata atau 0
    const hppDefault = Object.values(biayaPerCabang).length > 0
      ? Math.round(Object.values(biayaPerCabang).reduce((a, b) => a + b, 0) / Object.values(biayaPerCabang).length)
      : 0;

    try {
      let savedId: number | undefined;
      let kataAksi: string;
      if (editingMenu && editingMenu.id) {
        // UPDATE MENU
        savedId = editingMenu.id;
        await menuService.update(editingMenu.id, {
          nama: nama.trim(),
          harga: numHarga,
          kategori,
          gambar_url: finalImage,
          aktif,
          cabang: [...cabangDipilih],
          biaya_bahan_baku: hppDefault,
          biaya_per_cabang: biayaPerCabang,
          updated_at: nowIso,
        });
        kataAksi = 'diupdate';
      } else {
        // CREATE MENU
        const newMenu = await menuService.create({
          nama: nama.trim(),
          harga: numHarga,
          kategori,
          gambar_url: finalImage,
          biaya_bahan_baku: hppDefault,
          biaya_per_cabang: biayaPerCabang,
          aktif,
          cabang: [...cabangDipilih],
          created_at: nowIso,
          updated_at: nowIso,
        });
        savedId = newMenu.id;
        kataAksi = 'ditambahkan';
      }

      showToast(`Menu "${nama.trim()}" ${kataAksi} — tersimpan ke database.`, 'success');

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to save menu:', err);
      showToast('Gagal menyimpan menu.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!menuToDelete || !menuToDelete.id) return;
    setIsDeleting(true);
    try {
      // Soft delete - mark as deleted so it syncs to Supabase and persists
      await menuService.softDelete(menuToDelete.id);
      showToast(`Menu "${menuToDelete.nama}" dihapus.`, 'info');

      setMenuToDelete(null);
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to delete menu:', err);
      showToast('Gagal menghapus menu.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleAktif = async (menu: Menu) => {
    if (!menu.id) return;
    try {
      await menuService.update(menu.id, {
        aktif: !menu.aktif,
        updated_at: new Date().toISOString(),
      });
      await loadData();
      showToast(
        `Status menu "${menu.nama}" diubah menjadi ${!menu.aktif ? 'Tersedia' : 'Habis'}`,
        !menu.aktif ? 'success' : 'error'
      );
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // Filter
  const filtered = menus.filter((m) => {
    const namaMenu = String(m.nama ?? '');
    const kategoriMenu = String(m.kategori ?? '');
    const matchCat =
      selectedCat === 'Semua' || kategoriMenu.toLowerCase() === selectedCat.toLowerCase();
    const matchSearch =
      namaMenu.toLowerCase().includes(search.toLowerCase()) ||
      kategoriMenu.toLowerCase().includes(search.toLowerCase());
    const matchCabang =
      selectedCabang === 'Semua' ||
      (Array.isArray(m.cabang) ? m.cabang.some((c) => String(c ?? '').toLowerCase() === selectedCabang.toLowerCase()) : false);
    return matchCat && matchSearch && matchCabang;
  });

  return (
    <div className="pb-28 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold text-[var(--teks)] tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-[var(--utama-teks)]" />
            <span>{isOwner ? 'Kelola Daftar Menu' : 'Status Produk'}</span>
          </h2>
          <p className="text-xs text-[var(--redup)] mt-0.5">
            {isOwner
              ? 'Tambah menu baru (bisa untuk Cabang 1 & 2 sekaligus), update harga/nama/foto, atau hapus menu dari katalog kasir.'
              : 'Ketuk badge status untuk mengubah ketersediaan menu: Tersedia (hijau) atau Habis (merah).'}
          </p>
        </div>

        {/* Tambah menu — khusus owner (kasir tidak bisa kelola menu) */}
        {isOwner && (
          <button
            onClick={openAddModal}
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] text-white text-xs font-bold transition shadow-sm shadow-[var(--utama)]/20 active:scale-95 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu Baru</span>
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-[var(--kartu)] rounded-2xl p-3 border border-[var(--garis)]/90 shadow-2xs mb-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {['Semua', 'Makanan', 'Minuman', 'Lainnya'].map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCat(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                selectedCat.toLowerCase() === c.toLowerCase()
                  ? 'bg-[var(--utama)] text-white active:bg-[var(--utama)]'
                  : 'bg-[var(--latar)] text-[var(--redup)] hover:bg-[var(--garis)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Cabang filter (Owner only) */}
        {isOwner && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {['Semua', ...cabangList].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCabang(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedCabang === c
                    ? 'bg-[var(--utama)] text-white active:bg-[var(--utama)]'
                    : 'bg-[var(--latar)] text-[var(--redup)] hover:bg-[var(--garis)]'
                }`}
              >
                {c === 'Semua' ? <Building2 className="w-3.5 h-3.5" /> : c}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--redup)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama menu..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-[var(--garis)] outline-none focus:border-[var(--utama-teks)]"
          />
        </div>
      </div>

      {/* Loading Spinner for initial data fetch */}
      {isLoading && (
        <div className="flex justify-center items-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {/* Phone/Mobile View: Card List */}
      <div className="md:hidden space-y-2.5">
        {!isLoading && filtered.length === 0 ? (
          <div className="text-center py-12 bg-[var(--kartu)] rounded-3xl border border-dashed border-[var(--garis)] p-6 text-xs text-[var(--redup)]">
            Tidak ada menu yang cocok dengan pencarian.
          </div>
        ) : (
          filtered.map((menu) => (
            <div
              key={menu.id}
              className="bg-[var(--kartu)] rounded-2xl p-3 border border-[var(--garis)]/90 shadow-2xs flex items-center justify-between gap-2.5 transition"
            >
              {/* Foto & Info Menu */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="shrink-0 overflow-hidden">
                  {menu.gambar_url ? (
                    <img
                      src={menu.gambar_url}
                      alt={menu.nama}
                      className="w-13 h-13 rounded-xl object-cover border border-[var(--garis)]"
                    />
                  ) : (
                    <div
                      className="w-13 h-13 rounded-xl bg-[var(--latar)] border border-[var(--garis)] flex items-center justify-center text-[var(--redup)]"
                      aria-hidden="true"
                    >
                      <ImageOff className="w-5 h-5" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[var(--latar)] text-[var(--teks)]">
                      {menu.kategori}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAktif(menu)}
                      className={`text-[11px] font-black px-2 py-0.5 rounded-full cursor-pointer transition active:scale-95 ${
                        menu.aktif
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                      title="Ketuk untuk ubah status ketersediaan"
                    >
                      {menu.aktif ? 'Tersedia' : 'Habis'}
                    </button>
                  </div>
                  <h4 className="font-extrabold text-sm text-[var(--teks)] truncate leading-tight">
                    {menu.nama}
                  </h4>
                  <div className="text-sm font-black text-[var(--utama-teks)] mt-0.5">
                    {formatRupiah(menu.harga)}
                  </div>
                </div>
              </div>

              {/* Tombol Aksi Langsung (Khusus Owner) */}
              {isOwner && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditModal(menu)}
                    className="h-9 px-3 rounded-xl bg-[var(--utama-muda)] text-[var(--utama-teks)] hover:bg-[var(--utama-muda)] active:scale-95 font-bold text-xs flex items-center gap-1 border border-[var(--garis)]/80 transition"
                    title="Update / Edit Menu"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMenuToDelete(menu)}
                    className="w-9 h-9 rounded-xl bg-[var(--bahaya-muda)] text-[var(--bahaya-teks)] hover:bg-[var(--bahaya-muda)] active:scale-95 font-bold flex items-center justify-center border border-[var(--garis)] transition"
                    title="Hapus Menu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop/Tablet View: Table List */}
      <div className="hidden md:block bg-[var(--kartu)] rounded-3xl border border-[var(--garis)]/90 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--latar)] border-b border-[var(--garis)] text-[var(--redup)] uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-16">Foto</th>
                  <th className="py-3 px-4">Nama Menu</th>
                  <th className="py-3 px-4">Kategori</th>
                  {isOwner && <th className="py-3 px-4">Cabang</th>}
                  <th className="py-3 px-4 text-right">Harga Jual</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--garis)]">
                {filtered.map((menu) => (
                <tr key={menu.id} className="hover:bg-[var(--latar)]/70 transition">
                  <td className="py-3 px-4">
                    {menu.gambar_url ? (
                      <img
                        src={menu.gambar_url}
                        alt={menu.nama}
                        className="w-12 h-12 rounded-xl object-cover border border-[var(--garis)]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[var(--latar)] border border-[var(--garis)] flex items-center justify-center text-[var(--redup)]" aria-hidden="true">
                        <ImageOff className="w-4 h-4" />
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-[var(--teks)] text-sm">{menu.nama}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--latar)] text-[var(--teks)]">
                      {menu.kategori}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const validCabang = normalizeCabang(menu.cabang);
                          if (validCabang.length === 0) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-gray-100 text-gray-600">
                                - tidak memiliki cabang
                              </span>
                            );
                          }
                          if (
                            cabangList.length > 0 &&
                            cabangList.every((c) =>
                              validCabang.some((r) => String(r ?? '').toLowerCase() === String(c ?? '').toLowerCase())
                            )
                          ) {
                            return (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--utama-muda)] text-[var(--utama-teks)]">
                                Semua Cabang
                              </span>
                            );
                          }
                          return validCabang.map((c) => (
                            <span
                              key={c}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--utama-muda)] text-[var(--utama-teks)]"
                            >
                              {c}
                            </span>
                          ));
                        })()}
                      </div>
                    </td>
                  )}
                  <td className="py-3 px-4 text-right font-black text-[var(--utama-teks)] text-sm">
                    {formatRupiah(menu.harga)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => handleToggleAktif(menu)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                        menu.aktif
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200'
                          : 'bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200'
                      }`}
                      title="Ketuk untuk ubah status ketersediaan"
                    >
                      {menu.aktif ? 'Tersedia' : 'Habis'}
                    </button>
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(menu)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-[var(--utama-muda)] text-[var(--utama-teks)] hover:bg-[var(--utama-muda)] rounded-xl font-bold text-xs transition active:scale-95 border border-[var(--garis)] cursor-pointer"
                          title="Update Menu"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Update</span>
                        </button>

                        <button
                          onClick={() => setMenuToDelete(menu)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl font-bold text-xs transition active:scale-95 border border-rose-200 cursor-pointer"
                          title="Hapus Menu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </div>

      {/* Modal Add / Update Menu (Tanpa Modal Bahan Baku & Mendukung Foto Lokal) */}
      {isOwner && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl bg-[var(--kartu)] shadow-2xl overflow-hidden border border-[var(--garis)] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-4 bg-[var(--latar)] border-b border-[var(--garis)]">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-5 h-5 text-[var(--utama-teks)]" />
                <h3 className="font-extrabold text-[var(--teks)] text-sm">
                  {editingMenu ? `Update Menu: ${editingMenu.nama}` : 'Tambah Menu Baru'}
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

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[var(--teks)] mb-1">
                  Nama Menu <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Soto Ayam Lamongan"
                  className="w-full px-3.5 py-2.5 text-sm border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--teks)] mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none bg-[var(--kartu)] font-medium"
                  >
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--teks)] mb-1">
                    Harga Jual (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="500"
                    step="500"
                    value={harga}
                    onChange={(e) => setHarga(e.target.value)}
                    placeholder="25000"
                    className="w-full px-3.5 py-2.5 text-sm font-bold text-[var(--teks)] border border-[var(--garis)] rounded-xl focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                  />
                </div>
              </div>

              {/* Cabang (Owner only) — boleh pilih satu atau keduanya */}
              {isOwner && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--teks)] mb-1.5">
                    Cabang <span className="text-[var(--redup)] font-normal">(Opsional)</span>
                    <span className="text-[var(--redup)] font-normal"> — kosong = tidak memiliki cabang</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {/* Semua Cabang Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = cabangList.length > 0 && cabangList.every((c) => cabangDipilih.includes(c));
                        setCabangDipilih(allSelected ? [] : [...cabangList]);
                      }}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                        cabangList.length > 0 && cabangList.every((c) => cabangDipilih.includes(c))
                          ? 'bg-[var(--utama)] text-white border-[var(--utama)] shadow-sm shadow-[var(--utama)]/25'
                          : 'bg-[var(--kartu)] text-[var(--teks)] border-[var(--garis)] hover:border-[var(--garis-kuat)]'
                      }`}
                      aria-pressed={cabangList.length > 0 && cabangList.every((c) => cabangDipilih.includes(c))}
                    >
                      {cabangList.length > 0 && cabangList.every((c) => cabangDipilih.includes(c)) ? <Check className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                      <span>Semua Cabang</span>
                    </button>
                    {/* Individual branches */}
                    {cabangList.map((c) => {
                      const dipilih = cabangDipilih.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCabangDipilih(c)}
                          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition active:scale-95 cursor-pointer ${
                            dipilih
                              ? 'bg-[var(--utama)] text-white border-[var(--utama)] shadow-sm shadow-[var(--utama)]/25'
                              : 'bg-[var(--kartu)] text-[var(--teks)] border-[var(--garis)] hover:border-[var(--garis-kuat)]'
                          }`}
                          aria-pressed={dipilih}
                        >
                          {dipilih ? <Check className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                          <span>{c}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--redup)] mt-1.5">
                    Menu tampil pada cabang yang dicentang. Jika tidak memilih cabang, menu akan menampilkan <strong>- tidak memiliki cabang</strong>.
                  </p>
                </div>
              )}

            {/* HPP per Cabang (Owner only) */}
            {isOwner && cabangDipilih.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-[var(--teks)] mb-1.5">
                  HPP (Biaya Bahan Baku) per Cabang <span className="text-[var(--redup)] font-normal">(Opsional)</span>
                  <span className="text-[var(--redup)] font-normal"> — kosong = 0</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {cabangDipilih.map((c) => (
                    <div key={c} className="p-3 bg-[var(--latar)] rounded-xl border border-[var(--garis)]">
                      <label className="block text-xs font-medium text-[var(--teks)] mb-1">
                        {c}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={biayaPerCabang[c] || ''}
                        onChange={(e) => setBiayaPerCabang((prev) => ({ ...prev, [c]: e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0) }))}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm font-bold text-[var(--teks)] border border-[var(--garis)] rounded-lg focus:ring-2 focus:ring-[var(--utama-teks)]/30 focus:border-[var(--utama-teks)] outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

              {/* Local Photo Selection (Opsional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--teks)]">
                    Foto Makanan <span className="text-[var(--redup)] font-normal">(Opsional)</span>
                  </label>
                  {gambarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                    >
                      Hapus Foto
                    </button>
                  )}
                </div>

                <div className="p-3 bg-[var(--latar)] rounded-2xl border border-[var(--garis)] flex items-center gap-3.5">
                  {gambarUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={gambarUrl}
                        alt="Preview Foto"
                        className="w-16 h-16 rounded-xl object-cover border border-[var(--garis)] shadow-xs"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[var(--kartu)] border border-dashed border-[var(--garis-kuat)] flex items-center justify-center text-[var(--redup)] shrink-0" aria-hidden="true">
                      <ImageOff className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--kartu)] hover:bg-[var(--utama-muda)] border border-[var(--garis)] hover:border-[var(--garis-kuat)] text-[var(--teks)] hover:text-[var(--utama-teks)] text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95">
                      {isProcessingPhoto ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--utama-teks)]" />
                      ) : (
                        <Camera className="w-3.5 h-3.5 text-[var(--utama-teks)]" />
                      )}
                      <span>
                        {isProcessingPhoto
                          ? 'Memproses...'
                          : gambarUrl
                          ? 'Ganti dari Penyimpanan Lokal'
                          : 'Pilih dari Penyimpanan Lokal'}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isProcessingPhoto}
                        onChange={handleLocalPhotoChange}
                      />
                    </label>

                    <p className="text-[10px] text-[var(--redup)] leading-tight">
                      Ambil dari galeri HP atau berkas lokal. Jika tidak memilih foto, menu akan otomatis tampil dengan keterangan <em>Gambar tidak ada</em>.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  id="menuAktif"
                  checked={aktif}
                  onChange={(e) => setAktif(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--utama-teks)] focus:ring-[var(--utama-teks)]"
                />
                <label htmlFor="menuAktif" className="text-xs font-semibold text-[var(--teks)] cursor-pointer">
                  Status Tersedia (Menu aktif & dapat dipesan di Kasir)
                </label>
              </div>

              {/* Action buttons inside modal */}
              <div className="pt-3 border-t border-[var(--garis)] flex items-center justify-between gap-2">
                {editingMenu ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuToDelete(editingMenu);
                    }}
                    className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Hapus Menu</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-3.5 rounded-xl border border-[var(--garis)] text-xs font-semibold text-[var(--redup)] hover:bg-[var(--latar)] transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 active:scale-95 ${
                      isSaving
                        ? 'bg-[var(--garis)] cursor-not-allowed opacity-70'
                        : 'bg-[var(--utama)] hover:bg-[var(--utama-tua)] active:bg-[var(--utama)] shadow-sm shadow-[var(--utama)]/25'
                    }`}
                  >
                    {isSaving ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}
                    <span>{isSaving ? 'Menyimpan...' : editingMenu ? 'Simpan Perubahan' : 'Tambah Menu'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isOwner && menuToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-[var(--kartu)] shadow-2xl p-5 border border-[var(--garis)] animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-extrabold text-[var(--teks)] text-center">
              Hapus Menu Ini?
            </h3>
            <p className="text-xs text-[var(--redup)] text-center mt-1">
              Menu <strong className="text-[var(--teks)]">"{menuToDelete.nama}"</strong> akan dihapus permanen dari daftar kasir.
            </p>

            <div className="mt-4 flex items-center gap-3 p-2.5 rounded-2xl bg-[var(--latar)] border border-[var(--garis)]">
              {menuToDelete.gambar_url ? (
                <img
                  src={menuToDelete.gambar_url}
                  alt={menuToDelete.nama}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[var(--latar)] border border-[var(--garis)] flex items-center justify-center text-[var(--redup)] shrink-0" aria-hidden="true">
                  <ImageOff className="w-4 h-4" />
                </div>
              )}
              <div className="text-xs">
                <div className="font-bold text-[var(--teks)]">{menuToDelete.nama}</div>
                <div className="text-[var(--redup)]">{formatRupiah(menuToDelete.harga)}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMenuToDelete(null)}
                className="py-2.5 px-3 rounded-xl border border-[var(--garis)] text-xs font-semibold text-[var(--teks)] hover:bg-[var(--latar)] transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold text-white transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 ${
                  isDeleting
                    ? 'bg-[var(--garis)] cursor-not-allowed opacity-70'
                    : 'bg-[var(--bahaya)] hover:bg-[var(--bahaya-teks)] shadow-[var(--bahaya-teks)]/20'
                }`}
              >
                {isDeleting ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                <span>{isDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};