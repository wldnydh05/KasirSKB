/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  User,
  Menu,
  Transaksi,
  DetailTransaksi,
  Biaya,
  Promo,
  Kategori,
  PesananAktif,
  CartItem,
} from '../types';
import { globalLoading } from './globalLoading';

// ============================================
// SUPABASE SERVICE LAYER
// Replaces all Dexie/IndexedDB operations
// ============================================

// Helper to check Supabase availability
function assertSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}

// Wrapper to track global loading state for QUERY operations (triggers global loading bar)
async function withQueryLoading<T>(fn: () => Promise<T>): Promise<T> {
  globalLoading.startQuery();
  try {
    const result = await fn();
    globalLoading.stopQuery(true);
    return result;
  } catch (error) {
    globalLoading.stopQuery(false);
    throw error;
  }
}

// Wrapper for MUTATION operations (does NOT trigger global loading bar)
async function withMutationLoading<T>(fn: () => Promise<T>): Promise<T> {
  globalLoading.startMutation();
  try {
    const result = await fn();
    globalLoading.stopMutation();
    return result;
  } catch (error) {
    globalLoading.stopMutation();
    throw error;
  }
}

// ============================================
// USERS
// ============================================
export const userService = {
  async getAll(): Promise<User[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    });
  },

  async getById(id: number): Promise<User | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    });
  },

  async getByUsername(username: string): Promise<User | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .ilike('username', username)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async getByRole(role: 'staff' | 'owner'): Promise<User[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('role', role)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    });
  },

  async create(user: Omit<User, 'id'>): Promise<User> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .insert({
          ...user,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<User>): Promise<User> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('users')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },

  async getStaffByCabang(cabang: string): Promise<User[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('users')
        .select('*')
        .eq('role', 'staff')
        .eq('cabang', cabang)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    });
  },
};

// ============================================
// MENUS
// ============================================
export const menuService = {
  async getAll(includeDeleted = false): Promise<Menu[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      let query = supabase!.from('menus').select('*').order('kategori', { ascending: true }).order('nama', { ascending: true });
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  },

  async getByCabang(cabang: string, includeDeleted = false): Promise<Menu[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      // Cabang is stored as text[] in Supabase, use contains
      let query = supabase!.from('menus').select('*');
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }
      // Use contains for array overlap - menus where cabang array contains the cabang
      // Supabase: cabang::text[] @> ARRAY['Cabang 1']
      query = query.filter('cabang', 'cs', `{${cabang}}`);
      query = query.order('kategori', { ascending: true }).order('nama', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  },

  async getById(id: number): Promise<Menu | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('menus')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async create(menu: Omit<Menu, 'id'>): Promise<Menu> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('menus')
        .insert({
          ...menu,
          created_at: now,
          updated_at: now,
          synced: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<Menu>): Promise<Menu> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('menus')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('menus')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },

  async bulkCreate(menus: Omit<Menu, 'id'>[]): Promise<Menu[]> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('menus')
        .insert(menus.map(m => ({ ...m, created_at: now, updated_at: now, synced: true })))
        .select();
      if (error) throw error;
      return data || [];
    });
  },
};

// ============================================
// TRANSAKSI
// ============================================
export const transaksiService = {
  async getAll(): Promise<Transaksi[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('transaksi')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  },

  async getByDateRange(startDate: string, endDate: string, cabang?: string): Promise<Transaksi[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      let query = supabase!.from('transaksi').select('*').is('deleted_at', null);
      if (startDate) query = query.gte('tanggal', startDate);
      if (endDate) query = query.lte('tanggal', endDate);
      if (cabang && cabang !== 'Semua') query = query.eq('cabang', cabang);
      query = query.order('created_at', { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  },

  async getById(id: number): Promise<Transaksi | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('transaksi')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async create(transaksi: Omit<Transaksi, 'id'>): Promise<Transaksi> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('transaksi')
        .insert({
          ...transaksi,
          created_at: now,
          updated_at: now,
          synced: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<Transaksi>): Promise<Transaksi> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('transaksi')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('transaksi')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },

  async getDailyTotal(date: string, cabang?: string): Promise<number> {
    return withQueryLoading(async () => {
      assertSupabase();
      let query = supabase!.from('transaksi').select('total').eq('tanggal', date).is('deleted_at', null);
      if (cabang && cabang !== 'Semua') query = query.eq('cabang', cabang);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).reduce((sum, t) => sum + (t.total || 0), 0);
    });
  },
};

// ============================================
// DETAIL TRANSAKSI
// ============================================
export const detailTransaksiService = {
  async getByTransaksiId(transaksiId: number): Promise<DetailTransaksi[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('detail_transaksi')
        .select('*')
        .eq('transaksi_id', transaksiId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    });
  },

  async bulkCreate(details: Omit<DetailTransaksi, 'id'>[]): Promise<DetailTransaksi[]> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('detail_transaksi')
        .insert(details.map(d => ({ ...d, created_at: now, updated_at: now, synced: true })))
        .select();
      if (error) throw error;
      return data || [];
    });
  },
};

// ============================================
// PESANAN AKTIF
// ============================================
export const pesananAktifService = {
  async getAll(cabang?: string): Promise<PesananAktif[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      let query = supabase!.from('pesanan_aktif').select('*').is('deleted_at', null);
      if (cabang && cabang !== 'Semua') query = query.eq('cabang', cabang);
      query = query.order('created_at', { ascending: true }); // FIFO
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  },

  async getById(id: number): Promise<PesananAktif | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('pesanan_aktif')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async create(pesanan: Omit<PesananAktif, 'id'>): Promise<PesananAktif> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('pesanan_aktif')
        .insert({
          ...pesanan,
          created_at: now,
          updated_at: now,
          synced: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<PesananAktif>): Promise<PesananAktif> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('pesanan_aktif')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('pesanan_aktif')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },

  async getNextOrderNumber(): Promise<string> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('pesanan_aktif')
        .select('nomor_pesanan')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      if (!data || data.length === 0) return 'ORD-01';
      const lastNum = parseInt(data[0].nomor_pesanan?.replace('ORD-', '') || '0', 10);
      return `ORD-${String(lastNum + 1).padStart(2, '0')}`;
    });
  },
};

// ============================================
// KATEGORI
// ============================================
export const kategoriService = {
  async getAll(): Promise<Kategori[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('kategori')
        .select('*')
        .is('deleted_at', null)
        .order('urutan', { ascending: true });
      if (error) throw error;
      return data || [];
    });
  },

  async create(kategori: Omit<Kategori, 'id'>): Promise<Kategori> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('kategori')
        .insert({ ...kategori, created_at: now, updated_at: now, synced: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<Kategori>): Promise<Kategori> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('kategori')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('kategori')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },
};

// ============================================
// BIAYA
// ============================================
export const biayaService = {
  async getAll(): Promise<Biaya[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('biaya')
        .select('*')
        .is('deleted_at', null)
        .order('tanggal', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  },

  async getByDateRange(startDate: string, endDate: string): Promise<Biaya[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('biaya')
        .select('*')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .is('deleted_at', null)
        .order('tanggal', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  },

  async getByDate(date: string): Promise<Biaya | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('biaya')
        .select('*')
        .eq('tanggal', date)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async getByDateAndCabang(date: string, cabang: string): Promise<Biaya | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('biaya')
        .select('*')
        .eq('tanggal', date)
        .eq('cabang', cabang)
        .is('deleted_at', null)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    });
  },

  async create(biaya: Omit<Biaya, 'id'>): Promise<Biaya> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('biaya')
        .insert({ ...biaya, created_at: now, updated_at: now, synced: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<Biaya>): Promise<Biaya> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('biaya')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async upsertByDate(date: string, biaya: Partial<Biaya>): Promise<Biaya> {
    return withMutationLoading(async () => {
      assertSupabase();
      const existing = await this.getByDate(date);
      if (existing) {
        return this.update(existing.id!, { ...biaya, tanggal: date });
      }
      return this.create({ ...biaya, tanggal: date } as Omit<Biaya, 'id'>);
    });
  },

  async upsertByDateAndCabang(date: string, cabang: string, biaya: Partial<Biaya>): Promise<Biaya> {
    return withMutationLoading(async () => {
      assertSupabase();
      const existing = await this.getByDateAndCabang(date, cabang);
      if (existing) {
        return this.update(existing.id!, { ...biaya, tanggal: date, cabang });
      }
      return this.create({ ...biaya, tanggal: date, cabang } as Omit<Biaya, 'id'>);
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('biaya')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },
};

// ============================================
// PROMO
// ============================================
export const promoService = {
  async getAll(): Promise<Promo[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('promo')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    });
  },

  async getActive(date: string): Promise<Promo | null> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('promo')
        .select('*')
        .eq('aktif', true)
        .lte('tanggal_mulai', date)
        .gte('tanggal_selesai', date)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data?.[0] || null;
    });
  },

  async create(promo: Omit<Promo, 'id'>): Promise<Promo> {
    return withMutationLoading(async () => {
      assertSupabase();
      const now = new Date().toISOString();
      const { data, error } = await supabase!
        .from('promo')
        .insert({ ...promo, created_at: now, updated_at: now, synced: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async update(id: number, updates: Partial<Promo>): Promise<Promo> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('promo')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async softDelete(id: number): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('promo')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    });
  },
};

// ============================================
// APP CONFIG
// ============================================
export const appConfigService = {
  async getCabangList(): Promise<string[]> {
    return withQueryLoading(async () => {
      assertSupabase();
      const { data, error } = await supabase!
        .from('app_config')
        .select('value')
        .eq('key', 'cabang_list')
        .single();
      if (error) {
        if (error.code === 'PGRST116') return ['Cabang 1', 'Cabang 2'];
        throw error;
      }
      return Array.isArray(data?.value) ? data.value : ['Cabang 1', 'Cabang 2'];
    });
  },

  async setCabangList(cabangList: string[]): Promise<void> {
    return withMutationLoading(async () => {
      assertSupabase();
      const { error } = await supabase!
        .from('app_config')
        .upsert({
          key: 'cabang_list',
          value: cabangList,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
    });
  },
};

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================
export const realtimeService = {
  subscribeToMenus(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('menus_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'menus' },
        callback
      )
      .subscribe();
  },

  subscribeToTransaksi(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('transaksi_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaksi' },
        callback
      )
      .subscribe();
  },

  subscribeToPesananAktif(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('pesanan_aktif_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pesanan_aktif' },
        callback
      )
      .subscribe();
  },

  subscribeToBiaya(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('biaya_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biaya' },
        callback
      )
      .subscribe();
  },

  subscribeToUsers(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('users_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'users' },
        callback
      )
      .subscribe();
  },

  subscribeToCabangConfig(callback: (payload: any) => void) {
    assertSupabase();
    return supabase!
      .channel('app_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_config', filter: 'key=eq.cabang_list' },
        callback
      )
      .subscribe();
  },

  unsubscribe(channel: any) {
    if (channel) {
      supabase!.removeChannel(channel);
    }
  },
};

// ============================================
// UTILITY FUNCTIONS (replacing db helpers)
// ============================================
export function getFormattedDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFormattedTime(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function loadLocalCabangList(): string[] {
  try {
    const raw = localStorage.getItem('bukupos_cabang_list');
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
    // ignore
  }
  return ['Cabang 1', 'Cabang 2'];
}