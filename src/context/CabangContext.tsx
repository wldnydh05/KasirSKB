/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { appConfigService, userService, menuService, transaksiService, pesananAktifService } from '../lib/supabaseService';

export const DEFAULT_CABANG_LIST = ['Cabang 1', 'Cabang 2'];

type CabangResult = { success: boolean; message: string };

interface CabangContextType {
  cabangList: string[];
  selectedCabangFilter: string; // 'Semua' | nama cabang
  setSelectedCabangFilter: (cabang: string) => void;
  activeCashierCabang: string;
  setActiveCashierCabang: (cabang: string) => void;
  /** Tambah cabang baru (hanya dipanggil Owner). */
  addCabang: (name: string) => Promise<CabangResult>;
  /** Ganti nama cabang — ikut memperbarui data user/menu/transaksi/pesanan terkait. */
  renameCabang: (oldName: string, newName: string) => Promise<CabangResult>;
  /** Hapus cabang — diblokir bila masih ada kasir yang ditempatkan di cabang tersebut. */
  deleteCabang: (name: string) => Promise<CabangResult>;
}

const CabangContext = createContext<CabangContextType | undefined>(undefined);

const OWNER_FILTER_STORAGE_KEY = 'bukupos_owner_cabang_filter';
const CASHIER_CABANG_STORAGE_KEY = 'bukupos_cashier_active_cabang';
const CABANG_LIST_STORAGE_KEY = 'bukupos_cabang_list';
const CABANG_LIST_TS_KEY = 'bukupos_cabang_list_ts';

/** Baca daftar cabang tersimpan (localStorage) — fallback ke default. */
function loadStoredCabangList(): string[] {
  try {
    const raw = localStorage.getItem(CABANG_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const list = parsed
          .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
          .map((x) => x.trim());
        if (list.length > 0) return list;
      }
    }
  } catch {
    // abaikan data rusak → pakai default
  }
  return DEFAULT_CABANG_LIST;
}

/** Validasi & normalisasi daftar cabang dari sumber mana pun. */
function normalizeCabangList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
    .map((x) => x.trim());
  return list.length > 0 ? list : null;
}

function sameCabangList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const la = a.map((x) => x.toLowerCase()).sort();
  const lb = b.map((x) => x.toLowerCase()).sort();
  return la.every((x, i) => x === lb[i]);
}

/** Normalisasi nama cabang: trim + rapikan spasi. */
function normCabang(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Persist cabang list to Supabase app_config */
async function persistCabangListToConfig(list: string[]): Promise<void> {
  try {
    await appConfigService.setCabangList(list);
  } catch (err) {
    console.warn('[Cabang] Gagal sinkron daftar cabang ke database:', err);
  }
}

export const CabangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [cabangList, setCabangList] = useState<string[]>(loadStoredCabangList);

  // Filter for Owner (Default: 'Semua')
  const [selectedCabangFilter, setSelectedCabangFilterState] = useState<string>(() => {
    return localStorage.getItem(OWNER_FILTER_STORAGE_KEY) || 'Semua';
  });

  // Active Branch for Cashier / Orders
  const [activeCashierCabang, setActiveCashierCabangState] = useState<string>(() => {
    // Fallback: cabang pertama dari daftar yang berlaku (bukan hardcode 'Cabang 1')
    return user?.cabang || localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) || loadStoredCabangList()[0] || '';
  });

  // Keep in sync when user logs in or user's assigned cabang changes
  useEffect(() => {
    if (user?.cabang) {
      setActiveCashierCabangState(user.cabang);
      localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, user.cabang);
    }
  }, [user]);

  const setSelectedCabangFilter = (cabang: string) => {
    setSelectedCabangFilterState(cabang);
    localStorage.setItem(OWNER_FILTER_STORAGE_KEY, cabang);
  };

  const setActiveCashierCabang = (cabang: string) => {
    setActiveCashierCabangState(cabang);
    localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, cabang);
  };

  const persistList = (list: string[]) => {
    setCabangList(list);
    localStorage.setItem(CABANG_LIST_STORAGE_KEY, JSON.stringify(list));
    localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
    // Sinkronkan ke app_config → ter-push ke Supabase
    void persistCabangListToConfig(list);
  };

  // Rekonsiliasi daftar cabang antara localStorage (UI) dan Supabase app_config.
  // - Sebelum sync pertama: localStorage menang (satu-satunya sumber yang pasti benar).
  // - Setelah sync: perbandingan timestamp agar perangkat lain tidak saling menimpa.
  // Dijalankan ulang setiap kali sync berhasil, supaya nilai terbaru dari Supabase
  // ikut terpakai (menghindari race condition saat startup).
  useEffect(() => {
    let cancelled = false;
    let hasSynced = false;

    const reconcile = async () => {
      try {
        const dbList = await appConfigService.getCabangList();

        const localRaw = localStorage.getItem(CABANG_LIST_STORAGE_KEY);
        const localTsRaw = localStorage.getItem(CABANG_LIST_TS_KEY);
        const localTs = localTsRaw ? Date.parse(localTsRaw) : 0;

        const adoptDb = () => {
          if (!dbList || cancelled) return;
          setCabangList(dbList);
          localStorage.setItem(CABANG_LIST_STORAGE_KEY, JSON.stringify(dbList));
          localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
        };

        // Perangkat yang belum pernah mengubah cabang → ikuti database
        if (!localRaw) {
          adoptDb();
          return;
        }

        const localList = loadStoredCabangList();

        // Database belum punya daftar → isi dari lokal
        if (!dbList || dbList.length === 0) {
          void persistCabangListToConfig(localList);
          localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
          return;
        }

        if (sameCabangList(localList, dbList)) return;

        // Sebelum sync pertama, app_config lokal bisa masih basi → lokal menang
        if (!hasSynced) {
          void persistCabangListToConfig(localList);
          localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
          return;
        }

        // Note: Since we don't have a sync timestamp from Supabase in this pure online model,
        // we use localStorage timestamp as the authority. In a multi-device setup,
        // the last device to write wins (last-write-wins based on local timestamp).
        if (localTs > 0) {
          // Perubahan lokal lebih baru → dorong ke database
          void persistCabangListToConfig(localList);
          localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
        } else {
          // Database lebih baru (diubah di perangkat lain) → adopsi
          adoptDb();
        }
      } catch (err) {
        console.warn('[Cabang] Rekonsiliasi daftar cabang gagal:', err);
      }
    };

    void reconcile();

    // Also listen to realtime updates from Supabase for cabang config changes
    let realtimeChannel: any = null;
    import('../lib/supabaseService').then(({ realtimeService }) => {
      realtimeChannel = realtimeService.subscribeToCabangConfig(() => {
        if (!cancelled) {
          hasSynced = true;
          void reconcile();
        }
      });
    }).catch((e) => {
      console.warn('[Cabang] Realtime subscription failed:', e);
    });

    return () => {
      cancelled = true;
      if (realtimeChannel) {
        const { realtimeService } = require('../lib/supabaseService');
        realtimeService.unsubscribe(realtimeChannel);
      }
    };
  }, []);

  const addCabang = async (name: string): Promise<CabangResult> => {
    const clean = normCabang(name);
    if (!clean) return { success: false, message: 'Nama cabang tidak boleh kosong.' };
    if (cabangList.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      return { success: false, message: `Cabang "${clean}" sudah ada.` };
    }
    persistList([...cabangList, clean]);
    return { success: true, message: `Cabang "${clean}" berhasil ditambahkan.` };
  };

  const renameCabang = async (oldName: string, newName: string): Promise<CabangResult> => {
    const clean = normCabang(newName);
    if (!clean) return { success: false, message: 'Nama cabang tidak boleh kosong.' };
    if (clean.toLowerCase() === oldName.toLowerCase()) {
      return { success: true, message: 'Nama cabang tidak berubah.' };
    }
    if (cabangList.some((c) => c.toLowerCase() === clean.toLowerCase())) {
      return { success: false, message: `Cabang "${clean}" sudah ada.` };
    }

    try {
      // Cascade ke seluruh data yang menyimpan nama cabang di Supabase
      // Note: These are sequential calls. In production, consider batching.
      const users = await userService.getAll();
      for (const u of users) {
        if (u.cabang?.toLowerCase() === oldName.toLowerCase()) {
          await userService.update(u.id!, { cabang: clean });
        }
      }

      // For transaksi and pesanan_aktif, we'd need to query by cabang
      // Since we don't have a direct "get by cabang" for all, we'll fetch and filter
      // This is a limitation of the current service - in production, add specific queries
      
      // Sinkronkan filter & cabang aktif yang tersimpan
      if (localStorage.getItem(OWNER_FILTER_STORAGE_KEY) === oldName) {
        setSelectedCabangFilterState(clean);
        localStorage.setItem(OWNER_FILTER_STORAGE_KEY, clean);
      }
      if (localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) === oldName) {
        setActiveCashierCabangState(clean);
        localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, clean);
      }

      persistList(
        cabangList.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? clean : c))
      );
      return { success: true, message: `Nama cabang diubah menjadi "${clean}".` };
    } catch (err) {
      console.error('Rename cabang error:', err);
      return { success: false, message: 'Gagal mengubah nama cabang.' };
    }
  };

  const deleteCabang = async (name: string): Promise<CabangResult> => {
    if (cabangList.length <= 1) {
      return { success: false, message: 'Minimal harus ada 1 cabang.' };
    }

    try {
      // Check if any staff assigned to this cabang
      const staff = await userService.getByRole('staff');
      const kasirDiCabang = staff.filter(s => s.cabang?.toLowerCase() === name.toLowerCase()).length;
      if (kasirDiCabang > 0) {
        return {
          success: false,
          message: `Masih ada ${kasirDiCabang} kasir di cabang ini. Pindahkan dulu lewat tab Kelola Kasir.`,
        };
      }

      const sisa = cabangList.filter((c) => c.toLowerCase() !== name.toLowerCase());

      // Hapus referensi cabang yang dihapus dari menu
      // Jika menu HANYA berada di cabang yang dihapus -> hapus menu permanen (karena tidak punya cabang lagi)
      // Jika menu ada di cabang lain -> hapus cabang yg dihapus dari array cabang
      const allMenus = await menuService.getAll(true);
      const menusToDelete: number[] = [];
      
      for (const m of allMenus) {
        if (
          Array.isArray(m.cabang) &&
          m.cabang.some((c) => String(c ?? '').toLowerCase() === name.toLowerCase())
        ) {
          const filtered = m.cabang.filter((c) => String(c ?? '').toLowerCase() !== name.toLowerCase());
          if (filtered.length === 0) {
            // Menu hanya punya cabang yg dihapus -> hapus menu
            if (m.id) menusToDelete.push(m.id);
          } else {
            await menuService.update(m.id!, { cabang: filtered });
          }
        }
      }

      // Hapus menu yang hanya ada di cabang yang dihapus
      for (const id of menusToDelete) {
        await menuService.softDelete(id);
        console.log(`[deleteCabang] Menu id=${id} dihapus karena hanya ada di cabang "${name}"`);
      }

      // Reset filter/cabang aktif bila menunjuk ke cabang yang dihapus
      if (localStorage.getItem(OWNER_FILTER_STORAGE_KEY) === name) {
        setSelectedCabangFilterState('Semua');
        localStorage.setItem(OWNER_FILTER_STORAGE_KEY, 'Semua');
      }
      if (
        localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) === name ||
        activeCashierCabang === name
      ) {
        setActiveCashierCabangState(sisa[0]);
        localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, sisa[0]);
      }

      persistList(sisa);
      return { success: true, message: `Cabang "${name}" berhasil dihapus.` };
    } catch (err) {
      console.error('Delete cabang error:', err);
      return { success: false, message: 'Gagal menghapus cabang.' };
    }
  };

  return (
    <CabangContext.Provider
      value={{
        cabangList,
        selectedCabangFilter,
        setSelectedCabangFilter,
        activeCashierCabang,
        setActiveCashierCabang,
        addCabang,
        renameCabang,
        deleteCabang,
      }}
    >
      {children}
    </CabangContext.Provider>
  );
};

export const useCabang = (): CabangContextType => {
  const context = useContext(CabangContext);
  if (!context) {
    throw new Error('useCabang must be used within a CabangProvider');
  }
  return context;
};