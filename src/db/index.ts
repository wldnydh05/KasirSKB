/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import bcrypt from 'bcryptjs';
import { menuCabangList } from '../utils/menuCabang';
import type {
  User,
  Menu,
  Transaksi,
  DetailTransaksi,
  Biaya,
  Promo,
  Kategori,
  PesananAktif,
} from '../types';

// Sync engine exports
export { initializeSyncEngine, destroySyncEngine, getSyncState, subscribe, forceSync, syncHelpers, markDirty, markDirtyBulk } from './syncEngine';

// Re-export types for convenience
export type { User, Menu, Transaksi, DetailTransaksi, Biaya, Promo, Kategori, PesananAktif } from '../types';

export class SkbDatabase extends Dexie {
  users!: Table<User, number>;
  menus!: Table<Menu, number>;
  transaksi!: Table<Transaksi, number>;
  detail_transaksi!: Table<DetailTransaksi, number>;
  biaya!: Table<Biaya, number>;
  promo!: Table<Promo, number>;
  kategori!: Table<Kategori, number>;
  pesanan_aktif!: Table<PesananAktif, number>;

  constructor() {
    super('BukuPOS_DB');
    this.version(1).stores({
      users: '++id, &username, role, created_at',
      menus: '++id, nama, kategori, aktif, cabang, created_at',
      transaksi: '++id, tanggal, user_id, created_at',
      detail_transaksi: '++id, transaksi_id, menu_id, is_manual',
      biaya: '++id, tanggal, created_at',
      promo: '++id, nama, aktif, tanggal_mulai, tanggal_selesai',
      kategori: '++id, &nama, urutan, aktif',
    });
    this.version(2).stores({
      pesanan_aktif: '++id, nomor_pesanan, status, tanggal, created_at',
    });
    this.version(3).stores({
      users: '++id, &username, role, cabang, created_at',
      transaksi: '++id, tanggal, user_id, cabang, created_at',
      pesanan_aktif: '++id, nomor_pesanan, cabang, status, tanggal, created_at',
    });
    this.version(4).stores({
      menus: '++id, nama, kategori, aktif, cabang, created_at',
    });
    // v5: Menu.cabang berubah dari string tunggal → string[] (boleh Cabang 1 & Cabang 2 sekaligus)
    this.version(5)
      .stores({
        menus: '++id, nama, kategori, aktif, cabang, created_at',
      })
      .upgrade(async (tx) => {
        await tx.table('menus').toCollection().modify((m: Menu) => {
          if (typeof m.cabang === 'string') {
            m.cabang = m.cabang ? [m.cabang] : [];
          } else if (!Array.isArray(m.cabang)) {
            m.cabang = [];
          }
        });
      });
    
    // v6: Add sync fields (synced, updated_at, deleted_at) + app_config table for cabang list
    this.version(6)
      .stores({
        users: '++id, &username, role, cabang, created_at, updated_at, synced, deleted_at',
        menus: '++id, nama, kategori, aktif, cabang, created_at, updated_at, synced, deleted_at',
        transaksi: '++id, tanggal, user_id, cabang, created_at, updated_at, synced, deleted_at',
        detail_transaksi: '++id, transaksi_id, menu_id, is_manual, created_at, updated_at, synced, deleted_at',
        biaya: '++id, tanggal, created_at, updated_at, synced, deleted_at',
        promo: '++id, nama, aktif, tanggal_mulai, tanggal_selesai, created_at, updated_at, synced, deleted_at',
        kategori: '++id, &nama, urutan, aktif, created_at, updated_at, synced, deleted_at',
        pesanan_aktif: '++id, nomor_pesanan, cabang, status, tanggal, user_id, created_at, updated_at, synced, deleted_at',
        app_config: '&key, updated_at',
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();
        
        // Add sync fields to existing records
        const tables = [
          'users', 'menus', 'transaksi', 'detail_transaksi', 
          'biaya', 'promo', 'kategori', 'pesanan_aktif'
        ];
        
        for (const table of tables) {
          await tx.table(table).toCollection().modify((record: any) => {
            if (record.synced === undefined) record.synced = true;
            if (record.updated_at === undefined) record.updated_at = record.created_at || now;
            if (record.deleted_at === undefined) record.deleted_at = null;
          });
        }
        
        // Initialize app_config if not exists
        const existingConfig = await tx.table('app_config').get('cabang_list');
        if (!existingConfig) {
          await tx.table('app_config').add({
            key: 'cabang_list',
            value: ['Cabang 1'],
            updated_at: now,
          });
        }
      });

    // v7: Add user_id index to pesanan_aktif for rekeyUser FK updates
    this.version(7).stores({
      pesanan_aktif: '++id, nomor_pesanan, cabang, status, tanggal, user_id, created_at, updated_at, synced, deleted_at',
    });
  }
}

export const db = new SkbDatabase();

// Format date helper: YYYY-MM-DD
export function getFormattedDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format time helper: HH:mm:ss
export function getFormattedTime(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// ============================================
// DAFTAR MENU ASLI S.K.B (15 item)
// ============================================

interface SkbMenuDef {
  nama: string;
  harga: number;
  kategori: string;
  biaya: number;
  /** Bebek: harga diketik kasir (range di menu asli Rp13.000–20.000) */
  hargaCustom?: boolean;
  hargaRange?: string;
}

const REAL_SKB_MENUS: SkbMenuDef[] = [
  { nama: 'Ayam', harga: 9000, kategori: 'Makanan', biaya: 4000 },
  { nama: 'Sayap', harga: 5000, kategori: 'Makanan', biaya: 2000 },
  { nama: 'Lele', harga: 7000, kategori: 'Makanan', biaya: 3500 },
  { nama: 'Kepala Besar', harga: 4000, kategori: 'Makanan', biaya: 2000 },
  { nama: 'Kepala Kecil', harga: 2000, kategori: 'Makanan', biaya: 1000 },
  { nama: 'Kulit', harga: 2000, kategori: 'Makanan', biaya: 1000 },
  { nama: 'Ati', harga: 2000, kategori: 'Makanan', biaya: 1000 },
  { nama: 'Usus', harga: 2000, kategori: 'Makanan', biaya: 1000 },
  { nama: 'Tahu', harga: 1000, kategori: 'Makanan', biaya: 500 },
  { nama: 'Tempe', harga: 1000, kategori: 'Makanan', biaya: 500 },
  { nama: 'Bebek', harga: 13000, kategori: 'Makanan', biaya: 7000, hargaCustom: true, hargaRange: '13.000-20.000' },
  { nama: 'Nasi 1 Porsi', harga: 5000, kategori: 'Makanan', biaya: 2000 },
  { nama: 'Bakso', harga: 2000, kategori: 'Makanan', biaya: 1000 },
  { nama: 'Es Teh Manis', harga: 2000, kategori: 'Minuman', biaya: 1000 },
  { nama: 'Es Jeruk', harga: 4000, kategori: 'Minuman', biaya: 1500 },
];

const MENU_MIGRATION_KEY = 'bukupos_menu_real_v2';
const CLEAR_TRANSAKSI_KEY = 'bukupos_clear_transaksi_v2';
const SKIP_DEMO_DATA_KEY = 'bukupos_skip_demo_data_v1';

/**
 * Sinkronkan menu lokal dengan menu asli S.K.B (sekali jalan, ditandai localStorage):
 * - Rename nama lama ("Kepala"→"Kepala Kecil", "Es Teh"→"Es Teh Manis") → ID utuh, riwayat transaksi aman
 * - Tambah menu baru (Kepala Besar, Bakso), update harga (Bebek → custom)
 * - HAPUS menu junk di luar daftar asli / di luar Cabang 1-2 (data experiment lama
 *   seperti "Nasi Goreng Spesial", cabang "Depan Alfa") — referensi riwayat
 *   detail_transaksi di-null-kan dulu supaya riwayat transaksi tetap utuh
 * - Tandai semua menu synced:false agar ikut ter-push ke Supabase
 */
async function migrateMenuRealSkb(): Promise<void> {
  try {
    if (localStorage.getItem(MENU_MIGRATION_KEY)) return;

    const nowIso = new Date().toISOString();

    // 1. Rename nama lama (pertahankan ID agar referensi detail_transaksi tidak rusak)
    const renames: Record<string, { nama: string; harga: number }> = {
      kepala: { nama: 'Kepala Kecil', harga: 2000 },
      'es teh': { nama: 'Es Teh Manis', harga: 2000 },
    };
    const allMenus = await db.menus.toArray();
    for (const m of allMenus) {
      if (!m.id) continue;
      const r = renames[m.nama.trim().toLowerCase()];
      if (r && m.nama !== r.nama) {
        await db.menus.update(m.id, { nama: r.nama, harga: r.harga });
        m.nama = r.nama;
      }
    }

    // 2. Cocokkan dengan menu asli per cabang: update in-place atau tambah baru
    const keepIds = new Set<number>();
    for (const cabang of ['Cabang 1', 'Cabang 2']) {
      for (const def of REAL_SKB_MENUS) {
        const match = allMenus.find(
          (m) =>
            m.id !== undefined &&
            !keepIds.has(m.id) &&
            m.nama.trim().toLowerCase() === def.nama.toLowerCase() &&
            menuCabangList(m.cabang).includes(cabang)
        );
        if (match && match.id) {
          keepIds.add(match.id);
          await db.menus.update(match.id, {
            harga: def.harga,
            kategori: def.kategori,
            biaya_bahan_baku: def.biaya,
            aktif: true,
            harga_custom: Boolean(def.hargaCustom),
            harga_range: def.hargaRange,
          });
        } else {
          const newId = await db.menus.add({
            nama: def.nama,
            harga: def.harga,
            kategori: def.kategori,
            biaya_bahan_baku: def.biaya,
            aktif: true,
            gambar_url: '',
            cabang: [cabang],
            harga_custom: Boolean(def.hargaCustom),
            harga_range: def.hargaRange,
            created_at: nowIso,
            updated_at: nowIso,
          });
          keepIds.add(newId);
        }
      }
    }

    // 3. Hapus menu junk: nama di luar daftar asli, cabang di luar Cabang 1/2
    //    (mis. "Nasi Goreng Spesial", cabang "Depan Alfa"), atau duplikat.
    //    Referensi riwayat detail_transaksi di-null-kan dulu (menu_id nullable)
    //    supaya laporan keuangan lama tidak rusak.
    const junkIds = allMenus
      .map((m) => m.id)
      .filter((id): id is number => typeof id === 'number' && !keepIds.has(id));
    if (junkIds.length > 0) {
      await db.detail_transaksi.where('menu_id').anyOf(junkIds).modify({ menu_id: null });
      await db.menus.where('id').anyOf(junkIds).delete();
      console.log(`[Migrasi] ${junkIds.length} menu junk dihapus.`);
    }

    // 4. Jaring pengaman: semua menu di-mark belum-sync → ter-push ke Supabase
    await db.menus.toCollection().modify({ synced: false, updated_at: nowIso });

    localStorage.setItem(MENU_MIGRATION_KEY, '1');
    console.log('[Migrasi] Menu asli S.K.B (15 item) sudah diterapkan.');
  } catch (err) {
    console.error('Migrasi menu S.K.B gagal:', err);
  }
}

/**
 * Hapus SEMUA transaksi, detail_transaksi, dan pesanan_aktif (sekali jalan).
 * Diperlukan saat user ingin reset data transaksi ke 0 (mis. pindah Tahun ajaran / reset bulanan).
 * LocalStorage key 'bukupos_clear_transaksi_v1' memastikan hanya jalan sekali.
 */
async function clearAllTransaksiData(): Promise<void> {
  try {
    if (localStorage.getItem(CLEAR_TRANSAKSI_KEY)) return;

    console.log('[Migrasi] Menghapus SEMUA data transaksi, detail_transaksi, pesanan_aktif...');
    
    await db.transaksi.clear();
    await db.detail_transaksi.clear();
    await db.pesanan_aktif.clear();
    
    localStorage.setItem(CLEAR_TRANSAKSI_KEY, '1');
    localStorage.setItem(SKIP_DEMO_DATA_KEY, '1');
    console.log('[Migrasi] Semua data transaksi berhasil dihapus (lokal).');
  } catch (err) {
    console.error('Migrasi hapus transaksi gagal:', err);
  }
}

export async function seedDatabaseIfEmpty() {
  const userCount = await db.users.count();
  if (userCount > 0) {
    // Ensure any existing Snack items are cleanly migrated to Makanan and Snack category deleted
    try {
      await db.menus.where('kategori').equalsIgnoreCase('Snack').modify({ kategori: 'Makanan' });
      await db.kategori.where('nama').equalsIgnoreCase('Snack').delete();
    } catch {
      // ignore
    }

    // Clean up any old dummy Unsplash images from existing menus so user sees 'Gambar tidak ada'
    try {
      const existingMenus = await db.menus.toArray();
      for (const m of existingMenus) {
        if (m.gambar_url && m.gambar_url.includes('images.unsplash.com')) {
          await db.menus.update(m.id!, { gambar_url: '' });
        }
      }
      const existingUsers = await db.users.toArray();
      for (const u of existingUsers) {
        if (u.foto_url && u.foto_url.includes('images.unsplash.com')) {
          await db.users.update(u.id!, { foto_url: '' });
        }
      }
    } catch {
      // ignore
    }

    // Ensure 2 Branch Accounts exist & backfill data
    try {
      const kasirPinHash = bcrypt.hashSync('111111', 10);
      const nowIso = new Date().toISOString();

      // Standarisasi kredensial login (sekali jalan):
      // Owner → username "Rpap" / password "Rpap123", kasir → PIN "111111"
      await migrateKredensialLogin();

      // Sinkronkan daftar menu dengan menu asli S.K.B (sekali jalan)
      await migrateMenuRealSkb();

      // Hapus SEMUA data transaksi, detail_transaksi, pesanan_aktif (sekali jalan)
      await clearAllTransaksiData();

      // Owner
      const existingOwner = await db.users.where('role').equals('owner').first();
      if (existingOwner && (!existingOwner.cabang || existingOwner.cabang !== 'Semua Cabang')) {
        await db.users.update(existingOwner.id!, { cabang: 'Semua Cabang' });
      }

      // Kasir Cabang 1 (staff / kasir1)
      const existingStaff = await db.users.where('username').equalsIgnoreCase('staff').first();
      if (existingStaff) {
        await db.users.update(existingStaff.id!, {
          cabang: 'Cabang 1',
        });
      }

      const existingKasir1 = await db.users.where('username').equalsIgnoreCase('kasir1').first();
      if (!existingKasir1) {
        await db.users.add({
          username: 'kasir1',
          password_hash: kasirPinHash,
          role: 'staff',
          cabang: 'Cabang 1',
          foto_url: '',
          created_at: nowIso,
        });
      }

      // Kasir Cabang 2 (kasir2)
      const existingKasir2 = await db.users.where('username').equalsIgnoreCase('kasir2').first();
      if (!existingKasir2) {
        await db.users.add({
          username: 'kasir2',
          password_hash: kasirPinHash,
          role: 'staff',
          cabang: 'Cabang 2',
          foto_url: '',
          created_at: nowIso,
        });
      }

      // Backfill cabang on transactions if not yet tagged
      const allTx = await db.transaksi.toArray();
      for (const t of allTx) {
        if (!t.cabang && t.id) {
          const assignedCabang = t.id % 2 === 0 ? 'Cabang 2' : 'Cabang 1';
          const assignedStaff = assignedCabang === 'Cabang 1' ? 'kasir1' : 'kasir2';
          await db.transaksi.update(t.id, {
            cabang: assignedCabang,
            user_name: assignedStaff,
          });
        }
      }

      // Backfill cabang on active orders
      const allActive = await db.pesanan_aktif.toArray();
      for (const o of allActive) {
        if (!o.cabang && o.id) {
          const assignedCabang = o.id % 2 === 0 ? 'Cabang 2' : 'Cabang 1';
          await db.pesanan_aktif.update(o.id, {
            cabang: assignedCabang,
            user_name: assignedCabang === 'Cabang 1' ? 'kasir1' : 'kasir2',
          });
        }
      }
    } catch (e) {
      console.error('Failed to migrate multi-branch accounts/data:', e);
    }

    // Ensure 30 days of realistic historical data are present
    await ensureThirtyDaysData();
    return;
  }

  // 1. Seed Users (with hashed passwords)
  //    Owner: username "Rpap" / password "Rpap123" — Kasir: PIN "111111"
  const ownerPasswordHash = bcrypt.hashSync('Rpap123', 10);
  const kasirPinHash = bcrypt.hashSync('111111', 10);
  const nowIso = new Date().toISOString();

  const ownerId = await db.users.add({
    username: 'Rpap',
    password_hash: ownerPasswordHash,
    role: 'owner',
    cabang: 'Semua Cabang',
    foto_url: '',
    created_at: nowIso,
  });

  const staffId = await db.users.add({
    username: 'staff',
    password_hash: kasirPinHash,
    role: 'staff',
    cabang: 'Cabang 1',
    foto_url: '',
    created_at: nowIso,
  });

  await db.users.add({
    username: 'kasir1',
    password_hash: kasirPinHash,
    role: 'staff',
    cabang: 'Cabang 1',
    foto_url: '',
    created_at: nowIso,
  });

  await db.users.add({
    username: 'kasir2',
    password_hash: kasirPinHash,
    role: 'staff',
    cabang: 'Cabang 2',
    foto_url: '',
    created_at: nowIso,
  });

  // 2. Seed Categories
  const categories: Kategori[] = [
    { nama: 'Semua', urutan: 0, aktif: true },
    { nama: 'Makanan', urutan: 1, aktif: true },
    { nama: 'Minuman', urutan: 2, aktif: true },
    { nama: 'Lainnya', urutan: 3, aktif: true },
  ];
  for (const cat of categories) {
    await db.kategori.add(cat);
  }

  // 3. Seed Menus — daftar menu asli S.K.B (15 item per cabang, tanpa gambar)
  const initialMenus: Omit<Menu, 'id'>[] = [];
  for (const cabang of ['Cabang 1', 'Cabang 2']) {
    for (const m of REAL_SKB_MENUS) {
      initialMenus.push({
        nama: m.nama,
        harga: m.harga,
        kategori: m.kategori,
        biaya_bahan_baku: m.biaya,
        aktif: true,
        gambar_url: '',
        cabang: [cabang],
        harga_custom: Boolean(m.hargaCustom),
        harga_range: m.hargaRange,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  const menuIds: { id: number; nama: string; harga: number; bahan: number }[] = [];
  for (const item of initialMenus) {
    const id = await db.menus.add(item as Menu);
    menuIds.push({ id, nama: item.nama, harga: item.harga, bahan: item.biaya_bahan_baku || 0 });
  }
  // Seed baru sudah memakai menu asli S.K.B → tandai migrasi selesai
  localStorage.setItem(MENU_MIGRATION_KEY, '1');

  // 4. Seed Daily Operational Costs for past 7 days
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = getFormattedDate(date);
    await db.biaya.add({
      tanggal: dateStr,
      biaya_operasional: 150000, // Rp 150.000 / hari
      keterangan: 'Gas & listrik dapur, kebersihan, dan sewa harian S.K.B',
      created_at: date.toISOString(),
    });
  }

  // 5. Seed Promo
  await db.promo.add({
    nama: 'Promo Pelanggan Setia S.K.B 10%',
    tipe: 'persen',
    nilai: 10,
    tanggal_mulai: getFormattedDate(new Date(today.getTime() - 7 * 86400000)),
    tanggal_selesai: getFormattedDate(new Date(today.getTime() + 30 * 86400000)),
    aktif: true,
    created_at: nowIso,
  });

  // 6. Seed Realistic Historical Transactions for past 7 days (including today)
  // Generating a realistic curve of sales: 15-28 orders/day
  const ordersPerDay = [16, 22, 19, 25, 28, 24, 18]; // 6 days ago -> today
  const paymentMethods = ['Tunai', 'QRIS', 'Tunai', 'QRIS', 'Tunai'];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(today);
    dayDate.setDate(today.getDate() - dayOffset);
    const dateStr = getFormattedDate(dayDate);
    const orderCount = ordersPerDay[6 - dayOffset];

    for (let o = 0; o < orderCount; o++) {
      // Hour between 09:00 and 21:00
      const hour = 9 + Math.floor((o / orderCount) * 12);
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);
      const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
      const orderDate = new Date(dayDate);
      orderDate.setHours(hour, minute, second);

      // Pick 1 to 3 random menu items
      const itemsCount = 1 + Math.floor(Math.random() * 3);
      const chosenItems: { menu: typeof menuIds[0]; qty: number }[] = [];
      for (let k = 0; k < itemsCount; k++) {
        const randMenu = menuIds[Math.floor(Math.random() * menuIds.length)];
        const qty = 1 + (Math.random() > 0.75 ? 1 : 0);
        chosenItems.push({ menu: randMenu, qty });
      }

      const total = chosenItems.reduce((acc, it) => acc + it.menu.harga * it.qty, 0);
      const metode = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
      const roundedPayment = Math.ceil(total / 10000) * 10000;

      const txId = await db.transaksi.add({
        tanggal: dateStr,
        waktu: timeStr,
        total,
        user_id: staffId,
        user_name: 'kasir1',
        metode_pembayaran: metode,
        nominal_bayar: roundedPayment,
        kembalian: roundedPayment - total,
        created_at: orderDate.toISOString(),
      });

      for (const item of chosenItems) {
        await db.detail_transaksi.add({
          transaksi_id: txId,
          menu_id: item.menu.id,
          nama_item: item.menu.nama,
          harga_satuan: item.menu.harga,
          biaya_bahan_baku: item.menu.bahan,
          jumlah: item.qty,
          subtotal: item.menu.harga * item.qty,
          is_manual: false,
        });
      }
    }
  }

  // 7. Seed sample Active Orders (Belum Selesai / Menunggu Pembayaran)
  const activeCount = await db.pesanan_aktif.count();
  if (activeCount === 0) {
    const todayStr = getFormattedDate(today);
    await db.pesanan_aktif.add({
      nomor_pesanan: 'ORD-01',
      nama_pelanggan: 'Meja 3 - Mas Doni',
      nomor_meja: '3',
      catatan: 'Pedas sedang, es teh jangan terlalu manis',
      tanggal: todayStr,
      waktu: '12:15:00',
      total: 66000,
      status: 'menunggu_pembayaran',
      user_id: staffId,
      user_name: 'kasir1',
      created_at: new Date(Date.now() - 25 * 60000).toISOString(),
      items: [
        {
          nama: 'Bebek Goreng',
          harga: 28000,
          jumlah: 2,
          subtotal: 56000,
          biaya_bahan_baku: 13000,
          is_manual: false,
        },
        {
          nama: 'Es Teh Manis',
          harga: 5000,
          jumlah: 2,
          subtotal: 10000,
          biaya_bahan_baku: 1500,
          is_manual: false,
        },
      ],
    });

    await db.pesanan_aktif.add({
      nomor_pesanan: 'ORD-02',
      nama_pelanggan: 'Antrian #07 - Mbak Rini (Takeaway)',
      catatan: 'Bungkus pisah sambalnya',
      tanggal: todayStr,
      waktu: '12:35:00',
      total: 38000,
      status: 'menunggu_pembayaran',
      user_id: staffId,
      user_name: 'kasir1',
      created_at: new Date(Date.now() - 10 * 60000).toISOString(),
      items: [
        {
          nama: 'Bebek Penyet',
          harga: 30000,
          jumlah: 1,
          subtotal: 30000,
          biaya_bahan_baku: 14000,
          is_manual: false,
        },
        {
          nama: 'Lalapan + Sambal Terasi',
          harga: 8000,
          jumlah: 1,
          subtotal: 8000,
          biaya_bahan_baku: 3000,
          is_manual: false,
        },
      ],
    });
  }

  // Also ensure 30 days data is populated
  await ensureThirtyDaysData();

  console.log('S.K.B Database seeded successfully with initial data and active orders!');
}

const CRED_MIGRATION_KEY = 'bukupos_kredensial_v1';

/**
 * Standarisasi kredensial login (sekali jalan, ditandai localStorage):
 * - Owner  → username "Rpap" / password "Rpap123"
 * - Kasir  → PIN (password) "111111"
 * Password yang sudah diganti pengguna TIDAK di-reset (migrasi hanya jalan sekali).
 */
async function migrateKredensialLogin(): Promise<void> {
  /** Bandingkan password dengan hash; false jika hash tidak valid (tidak melempar). */
  const cocok = (plain: string, hash: string): boolean => {
    try {
      return bcrypt.compareSync(plain, hash);
    } catch {
      return false;
    }
  };

  try {
    if (localStorage.getItem(CRED_MIGRATION_KEY)) return;

    const owner = await db.users.where('role').equals('owner').first();
    if (owner && owner.id) {
      const targetUsername = 'Rpap';
      const bentrok = await db.users
        .where('username')
        .equalsIgnoreCase(targetUsername)
        .first();
      const patch: Partial<User> = {};
      if (!bentrok || bentrok.id === owner.id) patch.username = targetUsername;
      if (!cocok('Rpap123', owner.password_hash)) {
        patch.password_hash = bcrypt.hashSync('Rpap123', 10);
      }
      if (Object.keys(patch).length > 0) {
        await db.users.update(owner.id, patch);
      }
    }

    const pinHash = bcrypt.hashSync('111111', 10);
    const kasirList = await db.users.where('role').equals('staff').toArray();
    for (const k of kasirList) {
      if (k.id && !cocok('111111', k.password_hash)) {
        await db.users.update(k.id, { password_hash: pinHash });
      }
    }

    localStorage.setItem(CRED_MIGRATION_KEY, '1');
  } catch (err) {
    console.error('Migrasi kredensial login gagal:', err);
  }
}

/**
 * Ensures complete 30-day historical transactions and operational costs
 * so the Line Chart and Analytics always have rich, realistic data points.
 */
export async function ensureThirtyDaysData() {
  try {
    // Skip if user explicitly cleared all transactions (wants fresh 0 state)
    if (typeof localStorage !== 'undefined' && localStorage.getItem(SKIP_DEMO_DATA_KEY)) {
      console.log('[Demo Data] Skipping 30-day demo data generation (user cleared transaksi)');
      return;
    }
    const today = new Date();
    const allMenus = await db.menus.toArray();
    if (allMenus.length === 0) return;

    const staffUser = await db.users.where('role').equals('staff').first();
    const staffId = staffUser?.id || 2;
    const paymentMethods = ['Tunai', 'QRIS', 'Tunai', 'QRIS', 'Transfer'];

    // Realistic daily multipliers to create natural sales curves (weekend surges, weekday dips)
    const curveMultipliers = [
      1.2, 0.85, 0.9, 1.05, 1.35, 1.4, 0.95,
      0.9, 1.0, 1.15, 1.45, 1.5, 1.1, 0.88,
      0.92, 1.02, 1.25, 1.55, 1.48, 1.05, 0.9,
      0.95, 1.1, 1.3, 1.6, 1.52, 1.08, 0.92,
      1.15, 1.25
    ];

    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOffset);
      const dateStr = getFormattedDate(d);

      // Check how many transactions currently exist on this date
      const existingCount = await db.transaksi.where('tanggal').equals(dateStr).count();
      if (existingCount >= 8) continue; // Already has enough data

      // Add daily operational cost
      const existingBiaya = await db.biaya.where('tanggal').equals(dateStr).first();
      if (!existingBiaya) {
        const opsCost = 140000 + ((dayOffset * 3500) % 30000);
        await db.biaya.add({
          tanggal: dateStr,
          biaya_operasional: opsCost,
          keterangan: 'Operasional dapur S.K.B: gas, listrik & kebersihan',
          created_at: d.toISOString(),
        });
      }

      // Generate 12 to 28 transactions for this day
      const mult = curveMultipliers[29 - dayOffset] || 1.0;
      const targetOrders = Math.round(16 * mult);

      for (let o = 0; o < targetOrders; o++) {
        const hour = 9 + Math.floor((o / targetOrders) * 12);
        const minute = (o * 17) % 60;
        const second = (o * 23) % 60;
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        const orderDate = new Date(d);
        orderDate.setHours(hour, minute, second);

        // Pick 1 to 3 menu items
        const numItems = 1 + ((o + dayOffset) % 3);
        const chosenItems: { menu: Menu; qty: number }[] = [];
        for (let k = 0; k < numItems; k++) {
          const menuIndex = (o * 2 + k + dayOffset) % allMenus.length;
          const m = allMenus[menuIndex];
          const qty = 1 + ((k + o) % 4 === 0 ? 1 : 0);
          chosenItems.push({ menu: m, qty });
        }

        const total = chosenItems.reduce((acc, it) => acc + it.menu.harga * it.qty, 0);
        const metode = paymentMethods[(o + dayOffset) % paymentMethods.length];
        const roundedPayment = Math.ceil(total / 10000) * 10000;

        const isCabang1 = o % 2 !== 0;
        const txCabang = isCabang1 ? 'Cabang 1' : 'Cabang 2';
        const txUser = isCabang1 ? 'kasir1' : 'kasir2';

        const txId = await db.transaksi.add({
          tanggal: dateStr,
          waktu: timeStr,
          total,
          user_id: staffId,
          user_name: txUser,
          cabang: txCabang,
          metode_pembayaran: metode,
          nominal_bayar: roundedPayment,
          kembalian: roundedPayment - total,
          nama_pelanggan: `Pelanggan #${o + 1}`,
          nomor_meja: String(1 + (o % 12)),
          created_at: orderDate.toISOString(),
        });

        for (const item of chosenItems) {
          await db.detail_transaksi.add({
            transaksi_id: txId,
            menu_id: item.menu.id ?? null,
            nama_item: item.menu.nama,
            harga_satuan: item.menu.harga,
            biaya_bahan_baku: item.menu.biaya_bahan_baku || 0,
            jumlah: item.qty,
            subtotal: item.menu.harga * item.qty,
            is_manual: false,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to ensure 30 days dummy data:', err);
  }
}

