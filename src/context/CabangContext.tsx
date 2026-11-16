/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

export const DEFAULT_CABANG_LIST = ['Cabang 1', 'Cabang 2'];

interface CabangContextType {
  cabangList: string[];
  selectedCabangFilter: string; // 'Semua' | 'Cabang 1' | 'Cabang 2'
  setSelectedCabangFilter: (cabang: string) => void;
  activeCashierCabang: string; // 'Cabang 1' | 'Cabang 2'
  setActiveCashierCabang: (cabang: string) => void;
}

const CabangContext = createContext<CabangContextType | undefined>(undefined);

const OWNER_FILTER_STORAGE_KEY = 'bukupos_owner_cabang_filter';
const CASHIER_CABANG_STORAGE_KEY = 'bukupos_cashier_active_cabang';

export const CabangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [cabangList] = useState<string[]>(DEFAULT_CABANG_LIST);

  // Filter for Owner (Default: 'Semua')
  const [selectedCabangFilter, setSelectedCabangFilterState] = useState<string>(() => {
    return localStorage.getItem(OWNER_FILTER_STORAGE_KEY) || 'Semua';
  });

  // Active Branch for Cashier / Orders
  const [activeCashierCabang, setActiveCashierCabangState] = useState<string>(() => {
    return user?.cabang || localStorage.getItem(CASHIER_CABANG_STORAGE_KEY) || 'Cabang 1';
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

  return (
    <CabangContext.Provider
      value={{
        cabangList,
        selectedCabangFilter,
        setSelectedCabangFilter,
        activeCashierCabang,
        setActiveCashierCabang,
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

