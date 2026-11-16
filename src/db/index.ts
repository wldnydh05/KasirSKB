/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import bcrypt from 'bcryptjs';
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
      const defaultPasswordHash = bcrypt.hashSync('password123', 10);
      const nowIso = new Date().toISOString();

      // Owner
      const existingOwner = await db.users.where('username').equalsIgnoreCase('owner').first();
      if (existingOwner && (!existingOwner.cabang || existingOwner.cabang !== 'Semua Cabang')) {
        await db.users.update(existingOwner.id!, { cabang: 'Semua Cabang' });
      }

      // Kasir Cabang 1 (staff / kasir1)
      const existingStaff = await db.users.where('username').equalsIgnoreCase('staff').first();
      if (existingStaff) {
        await db.users.update(existingStaff.id!, {
          cabang: 'Cabang 1',
          nama_lengkap: 'Siti (Kasir Cabang 1)',
        });
      }

      const existingKasir1 = await db.users.where('username').equalsIgnoreCase('kasir1').first();
      if (!existingKasir1) {
        await db.users.add({
          username: 'kasir1',
          password_hash: defaultPasswordHash,
          role: 'staff',
          nama_lengkap: 'Siti (Kasir Cabang 1)',
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
          password_hash: defaultPasswordHash,
          role: 'staff',
          nama_lengkap: 'Rian (Kasir Cabang 2)',
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
          const assignedStaff = assignedCabang === 'Cabang 1' ? 'Siti (Kasir Cabang 1)' : 'Rian (Kasir Cabang 2)';
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
            user_name: assignedCabang === 'Cabang 1' ? 'Siti (Kasir Cabang 1)' : 'Rian (Kasir Cabang 2)',
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
  const defaultPasswordHash = bcrypt.hashSync('password123', 10);
  const nowIso = new Date().toISOString();

  const ownerId = await db.users.add({
    username: 'owner',
    password_hash: defaultPasswordHash,
    role: 'owner',
    nama_lengkap: 'Bapak Agus (Pemilik S.K.B)',
    cabang: 'Semua Cabang',
    foto_url: '',
    created_at: nowIso,
  });

  const staffId = await db.users.add({
    username: 'staff',
    password_hash: defaultPasswordHash,
    role: 'staff',
    nama_lengkap: 'Siti (Kasir Cabang 1)',
    cabang: 'Cabang 1',
    foto_url: '',
    created_at: nowIso,
  });

  await db.users.add({
    username: 'kasir1',
    password_hash: defaultPasswordHash,
    role: 'staff',
    nama_lengkap: 'Siti (Kasir Cabang 1)',
    cabang: 'Cabang 1',
    foto_url: '',
    created_at: nowIso,
  });

  await db.users.add({
    username: 'kasir2',
    password_hash: defaultPasswordHash,
    role: 'staff',
    nama_lengkap: 'Rian (Kasir Cabang 2)',
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

  // 3. Seed Menus (tanpa gambar dummy, upload gambar bersifat opsional)
  const initialMenus: Omit<Menu, 'id'>[] = [
    // Cabang 1
    { nama: 'Ayam', harga: 9000, kategori: 'Makanan', biaya_bahan_baku: 4000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Sayap', harga: 5000, kategori: 'Makanan', biaya_bahan_baku: 2000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Lele', harga: 7000, kategori: 'Makanan', biaya_bahan_baku: 3500, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Bebek', harga: 15000, kategori: 'Makanan', biaya_bahan_baku: 7000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Tempe', harga: 1000, kategori: 'Makanan', biaya_bahan_baku: 500, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Kepala', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Kulit', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Ati', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Usus', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Tahu', harga: 1000, kategori: 'Makanan', biaya_bahan_baku: 500, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Nasi 1/2 Porsi', harga: 3000, kategori: 'Makanan', biaya_bahan_baku: 1500, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Nasi 1 Porsi', harga: 5000, kategori: 'Makanan', biaya_bahan_baku: 2000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Es Teh', harga: 3000, kategori: 'Minuman', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    { nama: 'Es Jeruk', harga: 4000, kategori: 'Minuman', biaya_bahan_baku: 1500, aktif: true, gambar_url: '', cabang: 'Cabang 1', created_at: nowIso, updated_at: nowIso },
    // Cabang 2
    { nama: 'Ayam', harga: 9000, kategori: 'Makanan', biaya_bahan_baku: 4000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Sayap', harga: 5000, kategori: 'Makanan', biaya_bahan_baku: 2000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Lele', harga: 7000, kategori: 'Makanan', biaya_bahan_baku: 3500, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Bebek', harga: 15000, kategori: 'Makanan', biaya_bahan_baku: 7000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Tempe', harga: 1000, kategori: 'Makanan', biaya_bahan_baku: 500, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Kepala', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Kulit', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Ati', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Usus', harga: 2000, kategori: 'Makanan', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Tahu', harga: 1000, kategori: 'Makanan', biaya_bahan_baku: 500, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Nasi 1/2 Porsi', harga: 3000, kategori: 'Makanan', biaya_bahan_baku: 1500, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Nasi 1 Porsi', harga: 5000, kategori: 'Makanan', biaya_bahan_baku: 2000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Es Teh', harga: 3000, kategori: 'Minuman', biaya_bahan_baku: 1000, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
    { nama: 'Es Jeruk', harga: 4000, kategori: 'Minuman', biaya_bahan_baku: 1500, aktif: true, gambar_url: '', cabang: 'Cabang 2', created_at: nowIso, updated_at: nowIso },
  ];

  const menuIds: { id: number; nama: string; harga: number; bahan: number }[] = [];
  for (const item of initialMenus) {
    const id = await db.menus.add(item as Menu);
    menuIds.push({ id, nama: item.nama, harga: item.harga, bahan: item.biaya_bahan_baku || 0 });
  }

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
        user_name: 'Siti (Kasir)',
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
      user_name: 'Siti (Kasir)',
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
      user_name: 'Siti (Kasir)',
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

/**
 * Ensures complete 30-day historical transactions and operational costs
 * so the Line Chart and Analytics always have rich, realistic data points.
 */
export async function ensureThirtyDaysData() {
  try {
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
        const txUser = isCabang1 ? 'Siti (Kasir Cabang 1)' : 'Rian (Kasir Cabang 2)';

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

