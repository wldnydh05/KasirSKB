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

const MASTER_TABLES: TableName[] = [
  'users', 'kategori', 'menus', 'promo', 'biaya', 'app_config'
];
const TRANS_TABLES: TableName[] = [
  'transaksi', 'detail_transaksi', 'pesanan_aktif'
];
const ALL_TABLES = [...MASTER_TABLES, ...TRANS_TABLES];

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
    // 0. Reconcile local user IDs with remote (fix id conflicts from deleted/recreated kasir)
    await reconcileUsersWithRemote();
    
    // 1. Initial full pull (seed local from Supabase)
    for (const table of ALL_TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*').limit(5000);
        if (error) throw error;
        if (!data || data.length === 0) continue;
        
        if (table === 'users') {
          for (const rec of data) {
            // Match by username first to avoid unique constraint errors
            const localByUsername = await (db as any).table('users').where('username').equals(rec.username).first();
            if (localByUsername) {
              // Update local record with remote data (keep local id)
              await (db as any).table('users').update(localByUsername.id, {
                ...rec,
                username: rec.username,
                synced: true,
              });
            } else {
              // No local match — try to put by id, but check id conflict
              const existingById = await (db as any).table('users').get(rec.id);
              if (existingById && existingById.username !== rec.username) {
                // Local id exists with different username — skip (reconcile will fix)
                console.warn(`[SyncEngine] Skip user id=${rec.id} (${rec.username}): local id taken by ${existingById.username}`);
              } else {
                await (db as any).table('users').put({ ...rec, synced: true });
              }
            }
          }
        } else {
          const records = data.map((r: any) => ({ ...r, synced: true }));
          await (db as any).table(table).bulkPut(records);
        }
        console.log(`[SyncEngine] Initial pull ${table}: ${data.length} records`);
      } catch (error) {
        console.error(`[SyncEngine] Initial pull ${table} failed:`, error);
      }
    }
    
    // 2. Setup realtime subscriptions
    setupRealtime();
    
    // 3. Setup periodic sync
    syncInterval = setInterval(() => {
      if (navigator.onLine) syncNow();
    }, 30000);
    
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
  
  for (const table of ALL_TABLES) {
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
  } catch (error) {
    console.error(`[SyncEngine] Failed to apply remote change ${table}:`, error);
  }
}

// ============================================
// RECONCILE USER ID CONFLICTS
// ============================================

/** 
 * Bangun mapping ID lokal ↔ remote agar FK user_id konsisten.
 * Jalankan sebelum pull/push agar transaksi.user_id sudah benar.
 */
async function reconcileUsersWithRemote(): Promise<void> {
  if (!supabase) return;
  
  try {
    // Ambil user remote (id + username)
    const { data: remotes, error } = await supabase.from('users').select('id, username');
    if (error || !remotes) return;
    
    const remoteByName = new Map<string, number>(); // username → remote id
    const remoteById = new Map<number, string>();   // remote id → username
    for (const r of remotes) {
      remoteByName.set(r.username, r.id);
      remoteById.set(r.id, r.username);
    }
    
    const locals = await db.users.toArray();
    if (locals.length === 0) return;
    
    // Tentukan ID baru yang tidak bentrok
    let nextFreeId = Math.max(
      0,
      ...locals.map(u => u.id ?? 0),
      ...remotes.map(r => r.id)
    ) + 1;
    
    // Fase 1: ID lokal yang cocok remote id milik username LAIN → pindahkan ke fresh id
    // (terjadi saat kasir dihapus lalu dibuat ulang → id naik, remote id lama tetap ada)
    for (const l of locals) {
      if (!l.id) continue;
      const remoteNameAtThisId = remoteById.get(l.id);
      if (remoteNameAtThisId && remoteNameAtThisId !== l.username) {
        await rekeyUser(l.id, nextFreeId++);
        console.log(`[Reconcile] Moved local user ${l.username} (id ${l.id}) → ${nextFreeId - 1} (remote id ${l.id} belongs to ${remoteNameAtThisId})`);
      }
    }
    
    // Fase 2: Username sama tapi ID berbeda → adopsi ID remote
    const locals2 = await db.users.toArray();
    for (const l of locals2) {
      if (!l.id) continue;
      const remoteId = remoteByName.get(l.username);
      if (remoteId !== undefined && remoteId !== l.id) {
        // Target ID bebas (fase 1 sudah mengosongkannya)
        await rekeyUser(l.id, remoteId);
        console.log(`[Reconcile] Adopted remote id ${remoteId} for local user ${l.username} (was ${l.id})`);
      }
    }
  } catch (error) {
    console.error('[SyncEngine] Reconcile failed:', error);
  }
}

/** 
 * Ganti ID user lokal secara atomik: hapus lama, sisipkan baru, update FK di transaksi & pesanan_aktif.
 */
async function rekeyUser(oldId: number, newId: number): Promise<void> {
  const user = await db.users.get(oldId);
  if (!user) return;
  
  // Transaction-like: update related tables first, then user
  await db.transaksi.where('user_id').equals(oldId).modify({ 
    user_id: newId, 
    synced: false, 
    updated_at: new Date().toISOString() 
  });
  await db.pesanan_aktif.where('user_id').equals(oldId).modify({ 
    user_id: newId, 
    synced: false, 
    updated_at: new Date().toISOString() 
  });
  
  // Delete old, insert new with same data but new id
  await db.users.delete(oldId);
  const { id, synced, updated_at, ...rest } = user;
  await db.users.put({ ...rest, id: newId, synced: false, updated_at: new Date().toISOString() });
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
    // 0. Reconcile user IDs with remote (handles deleted/recreated kasir)
    await reconcileUsersWithRemote();
    
    // 1. PULL MASTER dulu → ID remote tersedia untuk FK
    await pullTables(MASTER_TABLES);
    
    // 2. PUSH MASTER (termasuk users yg baru dibuat lokal)
    await pushTables(MASTER_TABLES);
    
    // 3. PULL transaksional
    await pullTables(TRANS_TABLES);
    
    // 4. PUSH transaksional (FK user_id/menu_id sudah map ke ID remote)
    await pushTables(TRANS_TABLES);
    
    setLastSync(Date.now());
    await updatePendingCount();
    setStatus('idle');
    console.log('[SyncEngine] Sync completed');
  } catch (error) {
    console.error('[SyncEngine] Sync failed:', error);
    setStatus('error', error instanceof Error ? error.message : 'Sync failed');
  }
}

// Pull subset tabel
async function pullTables(tables: TableName[]): Promise<void> {
  if (!supabase) return;
  
  for (const table of tables) {
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
      
      if (table === 'users') {
        for (const rec of data) {
          // Match by username first to avoid unique constraint errors
          const localByUsername = await (db as any).table('users').where('username').equals(rec.username).first();
          if (localByUsername) {
            // Update local record with remote data (keep local id)
            await (db as any).table('users').update(localByUsername.id, {
              ...rec,
              username: rec.username,
              synced: true,
            });
          } else {
            // No local match — try to put by id, but check id conflict
            const existingById = await (db as any).table('users').get(rec.id);
            if (existingById && existingById.username !== rec.username) {
              // Local id exists with different username — skip (reconcile will fix)
              console.warn(`[SyncEngine] Skip user id=${rec.id} (${rec.username}): local id taken by ${existingById.username}`);
            } else {
              await (db as any).table('users').put({ ...rec, synced: true });
            }
          }
        }
      } else {
        const records = data.map((record: any) => ({ ...record, synced: true }));
        await (db as any).table(table).bulkPut(records);
      }
    } catch (error) {
      console.error(`[SyncEngine] Failed to pull ${table}:`, error);
    }
  }
}

// Push subset tabel dengan fallback per-baris
async function pushTables(tables: TableName[]): Promise<void> {
  if (!supabase) return;

  const lastSyncIso = new Date(state.lastSync).toISOString();

  for (const table of tables) {
    try {
      const unsynced = await (db as any)
        .table(table)
        .filter(
          (r: any) =>
            r.synced !== true ||
            (typeof r.updated_at === 'string' && r.updated_at > lastSyncIso)
        )
        .toArray();

      if (unsynced.length === 0) continue;

      console.log(`[SyncEngine] Pushing ${unsynced.length} records for ${table}`);

      const nowIso = new Date().toISOString();
      const records = unsynced.map((record: any) => {
        const { synced, ...rest } = record;
        if (!rest.updated_at) rest.updated_at = nowIso;
        return rest;
      });

      // app_config PK = 'key' (bukan 'id')
      const onConflict = table === 'app_config' ? 'key' : 'id';
      const okIds: (number | string)[] = [];

      for (let i = 0; i < records.length; i += 100) {
        const batch = records.slice(i, i + 100);
        const batchIds = unsynced
          .slice(i, i + 100)
          .map((r: any) => r.id)
          .filter((v: any) => v !== undefined);

        const { error } = await supabase
          .from(table)
          .upsert(batch, { onConflict, ignoreDuplicates: false });

        if (!error) {
          okIds.push(...batchIds);
          continue;
        }

        console.error(`[SyncEngine] Batch push error ${table}:`, error.message);
        for (let j = 0; j < batch.length; j++) {
          const { error: rowError } = await supabase
            .from(table)
            .upsert([batch[j]], { onConflict, ignoreDuplicates: false });
          if (rowError) {
            console.error(
              `[SyncEngine] Skip ${table} id=${batchIds[j] ?? batch[j].key}:`,
              rowError.message
            );
          } else if (batchIds[j] !== undefined) {
            okIds.push(batchIds[j]);
          }
        }
      }

      if (okIds.length > 0) {
        await (db as any).table(table).where('id').anyOf(okIds).modify({ synced: true });
      }
    } catch (error) {
      console.error(`[SyncEngine] Failed to push ${table}:`, error);
    }
  }
}

async function updatePendingCount(): Promise<void> {
  let total = 0;
  for (const table of ALL_TABLES) {
    const count = await (db as any)
      .table(table)
      .filter((r: any) => r.synced !== true)
      .count();
    total += count;
  }
  setPendingCount(total);
}

// ============================================
// HELPERS FOR SPECIFIC TABLES
// ============================================

function makeTableHelper(table: TableName) {
  return {
    markDirty: (id: number | string) => markDirty(table, id),
    markDirtyBulk: (ids: (number | string)[]) => markDirtyBulk(table, ids),
  };
}

export async function markDirty(table: TableName, id: number | string): Promise<void> {
  await (db as any).table(table).update(id, { 
    synced: false, 
    updated_at: new Date().toISOString() 
  });
}

export async function markDirtyBulk(table: TableName, ids: (number | string)[]): Promise<void> {
  const now = new Date().toISOString();
  for (const id of ids) {
    await (db as any).table(table).update(id, { synced: false, updated_at: now });
  }
}

export const syncHelpers = {
  users: makeTableHelper('users'),
  kategori: makeTableHelper('kategori'),
  menus: makeTableHelper('menus'),
  transaksi: {
    ...makeTableHelper('transaksi'),
    markDetailDirty: (ids: (number | string)[]) => markDirtyBulk('detail_transaksi', ids),
  },
  detail_transaksi: makeTableHelper('detail_transaksi'),
  biaya: makeTableHelper('biaya'),
  promo: makeTableHelper('promo'),
  pesanan_aktif: makeTableHelper('pesanan_aktif'),
  app_config: makeTableHelper('app_config'),
};