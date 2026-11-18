/**
 * Sync Engine - Handles bidirectional sync between Dexie (local) and Supabase (remote)
 * Local-first architecture: writes go to Dexie immediately, sync happens in background
 */

import { db } from './index';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

type TableName = 
  | 'users' 
  | 'kategori' 
  | 'menus' 
  | 'transaksi' 
  | 'detail_transaksi' 
  | 'biaya' 
  | 'promo' 
  | 'pesanan_aktif' 
  | 'app_config';

const TABLES: TableName[] = [
  'users', 'kategori', 'menus', 'transaksi', 'detail_transaksi',
  'biaya', 'promo', 'pesanan_aktif', 'app_config'
];

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncEngineState {
  status: SyncStatus;
  lastSync: number;
  pendingCount: number;
  error: string | null;
}

let state: SyncEngineState = {
  status: 'idle',
  lastSync: 0,
  pendingCount: 0,
  error: null,
};

const listeners: Set<(state: SyncEngineState) => void> = new Set();
let syncInterval: ReturnType<typeof setInterval> | null = null;
let realtimeChannel: any = null; // Supabase RealtimeChannel type
let isInitialized = false;

// ============================================
// STATE MANAGEMENT
// ============================================

function emit() {
  listeners.forEach(cb => cb({ ...state }));
}

function setStatus(status: SyncStatus, error: string | null = null) {
  state = { ...state, status, error };
  emit();
}

function setLastSync(timestamp: number) {
  state = { ...state, lastSync: timestamp };
  emit();
}

function setPendingCount(count: number) {
  state = { ...state, pendingCount: count };
  emit();
}

// ============================================
// PUBLIC API
// ============================================

export function getSyncState(): SyncEngineState {
  return { ...state };
}

export function subscribe(cb: (state: SyncEngineState) => void): () => void {
  listeners.add(cb);
  cb({ ...state });
  return () => listeners.delete(cb);
}

export async function forceSync(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    setStatus('error', 'Supabase not configured');
    return;
  }
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  await syncNow();
}

export async function initializeSyncEngine(): Promise<void> {
  if (isInitialized || !isSupabaseConfigured || !supabase) {
    if (!isSupabaseConfigured) {
      setStatus('idle');
    }
    return;
  }
  
  isInitialized = true;
  console.log('[SyncEngine] Initializing...');
  
  try {
    // 1. Initial pull - get all data from Supabase
    await pullAll();
    
    // 2. Setup realtime subscriptions
    setupRealtime();
    
    // 3. Setup periodic sync
    syncInterval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, 30000); // Every 30 seconds
    
    // 4. Online/offline handlers
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setStatus('idle');
    console.log('[SyncEngine] Initialized successfully');
  } catch (error) {
    console.error('[SyncEngine] Initialization failed:', error);
    setStatus('error', error instanceof Error ? error.message : 'Unknown error');
  }
}

export function destroySyncEngine(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (realtimeChannel) {
    supabase?.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  isInitialized = false;
  setStatus('idle');
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleOnline() {
  console.log('[SyncEngine] Online - triggering sync');
  setStatus('idle');
  syncNow();
}

function handleOffline() {
  console.log('[SyncEngine] Offline');
  setStatus('offline');
}

// ============================================
// REALTIME SUBSCRIPTIONS
// ============================================

function setupRealtime(): void {
  if (!supabase) return;
  
  realtimeChannel = supabase.channel('db_changes', {
    config: {
      broadcast: { self: false },
      presence: { key: '' },
    },
  });
  
  for (const table of TABLES) {
    realtimeChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload: { eventType: string; new: any; old: any }) => applyRemoteChange(table, payload)
    );
  }
  
  realtimeChannel.subscribe((status: string) => {
    console.log('[SyncEngine] Realtime status:', status);
    if (status === 'SUBSCRIBED') {
      setStatus('idle');
    } else if (status === 'CHANNEL_ERROR') {
      setStatus('error', 'Realtime connection failed');
    }
  });
}

// ============================================
// SYNC OPERATIONS
// ============================================

async function syncNow(): Promise<void> {
  if (state.status === 'syncing' || !navigator.onLine || !isSupabaseConfigured || !supabase) {
    return;
  }
  
  setStatus('syncing');
  console.log('[SyncEngine] Starting sync...');
  
  try {
    await pushLocalChanges();
    await pullAll();
    setLastSync(Date.now());
    await updatePendingCount();
    setStatus('idle');
    console.log('[SyncEngine] Sync completed');
  } catch (error) {
    console.error('[SyncEngine] Sync failed:', error);
    setStatus('error', error instanceof Error ? error.message : 'Sync failed');
  }
}

async function pushLocalChanges(): Promise<void> {
  if (!supabase) return;
  
  for (const table of TABLES) {
    try {
      // Get unsynced records (synced = false OR updated_at > lastSync)
      const unsynced = await (db as any).table(table)
        .where('synced').equals(false)
        .or('updated_at')
        .above(state.lastSync)
        .toArray();
      
      if (unsynced.length === 0) continue;
      
      console.log(`[SyncEngine] Pushing ${unsynced.length} records for ${table}`);
      
      // Convert to Supabase format (remove Dexie internal fields)
      const records = unsynced.map((record: any) => {
        const { synced, ...rest } = record;
        return rest;
      });
      
      // Upsert in batches of 100
      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const { error } = await supabase
          .from(table)
          .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });
        
        if (error) {
          console.error(`[SyncEngine] Push error for ${table}:`, error);
          throw error;
        }
      }
      
      // Mark as synced in local DB
      const ids = unsynced.map((r: any) => r.id).filter(Boolean);
      if (ids.length > 0) {
        await (db as any).table(table).where('id').anyOf(ids).modify({ synced: true });
      }
    } catch (error) {
      console.error(`[SyncEngine] Failed to push ${table}:`, error);
      // Don't throw - continue with other tables
    }
  }
}

async function pullAll(): Promise<void> {
  if (!supabase) return;
  
  for (const table of TABLES) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', new Date(state.lastSync).toISOString())
        .order('updated_at', { ascending: true })
        .limit(1000);
      
      if (error) throw error;
      if (!data || data.length === 0) continue;
      
      console.log(`[SyncEngine] Pulling ${data.length} records for ${table}`);
      
      // Add synced flag and upsert to Dexie
      const records = data.map((record: any) => ({
        ...record,
        synced: true,
      }));
      
      await (db as any).table(table).bulkPut(records);
    } catch (error) {
      console.error(`[SyncEngine] Failed to pull ${table}:`, error);
    }
  }
}

async function updatePendingCount(): Promise<void> {
  let total = 0;
  for (const table of TABLES) {
    const count = await (db as any).table(table).where('synced').equals(false).count();
    total += count;
  }
  setPendingCount(total);
}

// ============================================
// APPLY REMOTE CHANGES (from realtime)
// ============================================

function applyRemoteChange(table: TableName, payload: { eventType: string; new: any; old: any }): void {
  if (!payload || !payload.new) return;
  
  const eventType = payload.eventType; // INSERT, UPDATE, DELETE
  const newRecord = payload.new;
  const oldRecord = payload.old;
  
  console.log(`[SyncEngine] Realtime: ${eventType} on ${table}`, newRecord?.id);
  
  try {
    switch (eventType) {
      case 'INSERT':
      case 'UPDATE':
        // Server wins for master data, merge for transactional
        const record = { ...newRecord, synced: true };
        (db as any).table(table).put(record);
        break;
        
      case 'DELETE':
        // Soft delete - mark as deleted locally
        if (oldRecord?.id) {
          (db as any).table(table).update(oldRecord.id, { 
            deleted_at: new Date().toISOString(),
            synced: true 
          });
        }
        break;
    }
    
    updatePendingCount();
  } catch (error) {
    console.error(`[SyncEngine] Failed to apply remote change for ${table}:`, error);
  }
}

// ============================================
// MARK RECORD AS DIRTY (call after local write)
// ============================================

export async function markDirty(table: TableName, id: number | string): Promise<void> {
  try {
    await (db as any).table(table).update(id, { 
      synced: false, 
      updated_at: new Date().toISOString() 
    });
    await updatePendingCount();
    
    // Trigger immediate sync if online
    if (navigator.onLine && state.status === 'idle') {
      setTimeout(() => syncNow(), 100);
    }
  } catch (error) {
    console.error(`[SyncEngine] Failed to mark dirty ${table}/${id}:`, error);
  }
}

export async function markDirtyBulk(table: TableName, ids: (number | string)[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const now = new Date().toISOString();
    for (const id of ids) {
      await (db as any).table(table).update(id, { synced: false, updated_at: now });
    }
    await updatePendingCount();
    
    if (navigator.onLine && state.status === 'idle') {
      setTimeout(() => syncNow(), 100);
    }
  } catch (error) {
    console.error(`[SyncEngine] Failed to mark dirty bulk ${table}:`, error);
  }
}

// ============================================
// HELPERS FOR SPECIFIC TABLES
// ============================================

export const syncHelpers = {
  users: {
    markDirty: (id: number) => markDirty('users', id),
  },
  menus: {
    markDirty: (id: number) => markDirty('menus', id),
  },
  transaksi: {
    markDirty: (id: number) => markDirty('transaksi', id),
    markDetailDirty: (detailIds: number[]) => markDirtyBulk('detail_transaksi', detailIds),
  },
  biaya: {
    markDirty: (id: number) => markDirty('biaya', id),
  },
  kategori: {
    markDirty: (id: number) => markDirty('kategori', id),
  },
  promo: {
    markDirty: (id: number) => markDirty('promo', id),
  },
  pesanan_aktif: {
    markDirty: (id: number) => markDirty('pesanan_aktif', id),
  },
  app_config: {
    markDirty: (key: string) => markDirty('app_config', key),
  },
};