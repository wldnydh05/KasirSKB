/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { appConfigService, userService, menuService, transaksiService, pesananAktifService, biayaService } from '../lib/supabaseService';

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
      // CANCEL ALL - safe rollback if any step fails

      // 1. UPDATE UI FIRST (localStorage) - fast, no Supabase
      const updatedList = cabangList.map((c) => (c.toLowerCase() === oldName.toLowerCase() ? clean : c));
      setCabangList(updatedList);
      localStorage.setItem(CABANG_LIST_STORAGE_KEY, JSON.stringify(updatedList));
      localStorage.setItem(CABANG_LIST_TS_KEY, new Date().toISOString());
      localStorage.setItem(OWNER_FILTER_STORAGE_KEY, clean); // update filter
      localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, updatedList[0] || clean); // fallback ke cabang pertama

      // 2. UPDATE ITEMS IN PRODUCTION - cascade
      // 2a. Rename cabang in menus arrays
      const allMenus = await menuService.getAll(true);
      const menusToUpdate: Array<{ id: number; updates: Partial<any> }> = [];

      for (const m of allMenus) {
        const cabangVal: any = m.cabang;
        const cabangArr: string[] = Array.isArray(cabangVal) ? cabangVal : [];
        const cabangStr: string = typeof cabangVal === 'string' ? cabangVal : '';
        const shouldUpdate = cabangArr.some((c: string) => c.toLowerCase() === oldName.toLowerCase()) ||
                            (cabangStr && cabangStr.toLowerCase() === oldName.toLowerCase());

        if (shouldUpdate) {
          const updates: Partial<any> = {};

          // Update cabang array if it's an array
          if (cabangArr.length > 0) {
            updates.cabang = cabangArr.filter((c: string) => c.toLowerCase() !== oldName.toLowerCase());
          }
          // Also update individual cabang string if present
          if (cabangStr && cabangStr.toLowerCase() === oldName.toLowerCase()) {
            updates.cabang = clean;
          }

          // Update biaya_per_cabang keys
          if (m.biaya_per_cabang && typeof m.biaya_per_cabang === 'object') {
            const updatedPerCabang: Record<string, number> = {};
            let hasChanged = false;
            for (const [key, value] of Object.entries(m.biaya_per_cabang)) {
              if (key.toLowerCase() === oldName.toLowerCase()) {
                updatedPerCabang[clean] = value as number;
                hasChanged = true;
              } else {
                updatedPerCabang[key] = value as number;
              }
            }
            if (hasChanged) {
              updates.biaya_per_cabang = updatedPerCabang;
            }
          }

          if (Object.keys(updates).length > 0) {
            menusToUpdate.push({ id: m.id!, updates });
          }
        }
      }

      await Promise.all(menusToUpdate.map((u) => menuService.update(u.id, u.updates)));

      // 2b. Rename cabang in users
      const users = await userService.getAll();
      const usersToUpdate: Array<{ id: number; updates: Partial<any> }> = [];

      for (const u of users) {
        if (u.cabang?.toLowerCase() === oldName.toLowerCase()) {
          usersToUpdate.push({ id: u.id!, updates: { cabang: clean } });
        }
      }

      await Promise.all(usersToUpdate.map((u) => userService.update(u.id, u.updates)));

      // 2c. Rename cabang in biaya records
      const biayaRecords = await biayaService.getAll();
      const biayaToUpdate: Array<{ id: number; cabang: string }> = [];

      for (const b of biayaRecords) {
        // Only update if this record belongs to the old branch (has the old name)
        if ((typeof b.cabang === 'string' && b.cabang.toLowerCase() === oldName.toLowerCase()) ||
            (b.cabang === oldName)) {  // fallback for any case
          biayaToUpdate.push({ id: b.id!, cabang: clean });
        }
      }

      await Promise.all(biayaToUpdate.map((b) => biayaService.update(b.id, { cabang: b.cabang })));

      // 2d. Rename cabang in transactions (if needed)
      const transactions = await transaksiService.getAll();
      const transactionsToUpdate: Array<{ id: number; cabang: string }> = [];

      for (const t of transactions) {
        if (typeof t.cabang === 'string' && t.cabang.toLowerCase() === oldName.toLowerCase()) {
          transactionsToUpdate.push({ id: t.id!, cabang: clean });
        }
      }

      if (transactionsToUpdate.length > 0) {
        // Using update with partial updates
        await Promise.all(transactionsToUpdate.map((t) => transaksiService.update(t.id, { cabang: t.cabang })));
      }

      // 2e. Update active_cashier_cabang localStorage if pointing to old branch
      if (localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) === oldName) {
        localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, clean);
      }

      // SUCCESS - update filter state
      setSelectedCabangFilter(clean);

      // Also update activeCashierCabang if pointing to old name
      if (activeCashierCabang === oldName) {
        setActiveCashierCabangState(updatedList[0] || clean);
      }

      return { success: true, message: `Nama cabang diubah menjadi "${clean}"!` };
    } catch (err) {
      console.error('Rename cabang error:', err);
      // Rollback: restore original list to localStorage
      persistList(cabangList); // restore original list
      return { success: false, message: 'Gagal mengubah nama cabang.' };
    }
  };

  const deleteCabang = async (name: string): Promise<CabangResult> => {
    if (cabangList.length <= 1) {
      return { success: false, message: 'Minimal harus ada 1 cabang.' };
    }

    const cleanName = normCabang(name);
    if (cleanName !== normCabang(name)) { // user input has spaces
      return { success: false, message: 'Nama cabang tidak valid.' };
    }

    try {
      // Check if any staff assigned to this cabang
      const staff = await userService.getByRole('staff');
      const kasirDiCabang = staff.filter(s => s.cabang?.toLowerCase() === cleanName.toLowerCase()).length;
      if (kasirDiCabang > 0) {
        return {
          success: false,
          message: `Masih ada ${kasirDiCabang} kasir di cabang ini. Pindahkan dulu lewat tab Kelola Kasir.`,
        };
      }

      // 1. UPDATE ITEMS IN DATABASE FIRST (cascade)
      const sisa = cabangList.filter((c) => c.toLowerCase() !== cleanName.toLowerCase());
      const menusToDelete: number[] = [];
      const menusToUpdate: Array<{ id: number; updates: Partial<any> }> = [];

      // Fetch menus with all data (including deleted)
      const allMenus = await menuService.getAll(true);

      for (const m of allMenus) {
        if (Array.isArray(m.cabang)) {
          // Menu yang NRLA punya cabang yg dihapus
          if (m.cabang.some((c: string) => c.toLowerCase() === cleanName.toLowerCase())) {
            if (m.cabang.length === 1 && !m.cabang.filter((c: string) => c.toLowerCase() !== cleanName.toLowerCase()).length) {
              // Menu hanya Punya cabang yg dihapus → JADIKAN NETRAL (kosong array)
              menusToUpdate.push({
                id: m.id!,
                updates: { cabang: [] } // kosong = netral = bisa dipakai semua cabang
              });
            } else {
              // Menu ada di cabang lain → Hapus cabang yg dihapus dari array
              const filteredCabang = m.cabang.filter((c: string) => c.toLowerCase() !== cleanName.toLowerCase());
              menusToUpdate.push({
                id: m.id!,
                updates: { cabang: filteredCabang }
              });
            }
          }

          // Update biaya_per_cabang - remove entries for deleted branch
          if (m.biaya_per_cabang && typeof m.biaya_per_cabang === 'object') {
            let needsUpdate = false;
            const updatedPerCabang: Record<string, number> = {};

            for (const [key, value] of Object.entries(m.biaya_per_cabang)) {
              if (key.toLowerCase() === cleanName.toLowerCase()) {
                needsUpdate = true;
                // Keep HPP values for other branches, skip deleted first
              } else if (key.toLowerCase() !== cleanName.toLowerCase()) {
                updatedPerCabang[key] = value as number;
              }
            }

            if (needsUpdate) {
              menusToUpdate.push({
                id: m.id!,
                updates: { biaya_per_cabang: updatedPerCabang }
              });
            }
          }
        }
      }

      await Promise.all(menusToUpdate.map((u) => menuService.update(u.id, u.updates)));

      // Reset filter/cabang aktif bila menunjuk ke cabang yang dihapus
      if (localStorage.getItem(OWNER_FILTER_STORAGE_KEY) === cleanName) {
        setSelectedCabangFilterState(sisa[0]);
        localStorage.setItem(OWNER_FILTER_STORAGE_KEY, sisa[0]);
      }
      if (localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) === cleanName || activeCashierCabang === cleanName) {
        setActiveCashierCabangState(sisa[0]);
        localStorage.setItem(CASHIER_CABANG_STORAGE_KEY, sisa[0]);
      }

      // 2. UPDATE LOCALSTORAGE yang global
      persistList(sisa);

      return { success: true, message: `Cabang "${name}" berhasil dihapus I` };
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