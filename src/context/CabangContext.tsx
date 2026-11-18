/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../db';

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

/** Normalisasi nama cabang: trim + rapikan spasi. */
function normCabang(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
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
    return user?.cabang || localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) || 'Cabang 1';
  });

  // Keep in sync when user logs in or user's assigned cabang changes
  React.useEffect(() => {
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
  };

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
      // Cascade ke seluruh data yang menyimpan nama cabang
      await db.users.where('cabang').equalsIgnoreCase(oldName).modify({ cabang: clean });
      await db.transaksi.where('cabang').equalsIgnoreCase(oldName).modify({ cabang: clean });
      await db.pesanan_aktif.where('cabang').equalsIgnoreCase(oldName).modify({ cabang: clean });
      await db.menus.toCollection().modify((m) => {
        if (Array.isArray(m.cabang)) {
          m.cabang = m.cabang.map((c) =>
            c.toLowerCase() === oldName.toLowerCase() ? clean : c
          );
        }
      });

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
      const kasirDiCabang = await db.users
        .where('cabang')
        .equalsIgnoreCase(name)
        .count();
      if (kasirDiCabang > 0) {
        return {
          success: false,
          message: `Masih ada ${kasirDiCabang} kasir di cabang ini. Pindahkan dulu lewat tab Kelola Kasir.`,
        };
      }

      const sisa = cabangList.filter((c) => c.toLowerCase() !== name.toLowerCase());

      // Cabang yang dihapus dihapus dari menu; bila menu jadi tanpa cabang, tampilkan ke semua cabang sisa
      await db.menus.toCollection().modify((m) => {
        if (
          Array.isArray(m.cabang) &&
          m.cabang.some((c) => c.toLowerCase() === name.toLowerCase())
        ) {
          const baru = m.cabang.filter((c) => c.toLowerCase() !== name.toLowerCase());
          m.cabang = baru.length > 0 ? baru : sisa;
        }
      });

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
