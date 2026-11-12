/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'staff' | 'owner';

export interface CabangInfo {
  id: string;
  nama: string;
  alamat?: string;
}

export interface User {
  id?: number;
  username: string;
  password_hash: string;
  role: UserRole;
  nama_lengkap?: string;
  cabang?: string; // 'Cabang 1' | 'Cabang 2'
  foto_url?: string;
  created_at: string;
}

export interface Menu {
  id?: number;
  nama: string;
  harga: number;
  kategori: string;
  gambar_url?: string;
  biaya_bahan_baku?: number;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaksi {
  id?: number;
  nomor_pesanan?: string;
  cabang?: string; // 'Cabang 1' | 'Cabang 2'
  tanggal: string; // YYYY-MM-DD
  waktu: string;   // HH:mm:ss
  total: number;
  user_id: number;
  user_name?: string;
  metode_pembayaran?: string; // Tunai, QRIS, Transfer
  nominal_bayar?: number;
  kembalian?: number;
  nama_pelanggan?: string;
  tipe_pesanan?: 'Makan Di Tempat' | 'Bungkus';
  nomor_meja?: string;
  catatan?: string;
  created_at: string;
}

export interface DetailTransaksi {
  id?: number;
  transaksi_id: number;
  menu_id?: number | null;
  nama_item: string;
  harga_satuan: number;
  biaya_bahan_baku?: number;
  jumlah: number;
  subtotal: number;
  is_manual: boolean;
}

export interface Biaya {
  id?: number;
  tanggal: string; // YYYY-MM-DD
  biaya_operasional: number;
  keterangan?: string;
  created_at: string;
}

export interface Promo {
  id?: number;
  nama: string;
  tipe: 'nominal' | 'persen';
  nilai: number;
  tanggal_mulai: string;
  tanggal_selesai: string;
  aktif: boolean;
  created_at: string;
}

export interface Kategori {
  id?: number;
  nama: string;
  urutan: number;
  aktif: boolean;
}

export interface CartItem {
  menu_id?: number | null;
  nama: string;
  harga: number;
  biaya_bahan_baku?: number;
  jumlah: number;
  subtotal: number;
  gambar_url?: string;
  is_manual?: boolean;
}

export interface PesananAktif {
  id?: number;
  nomor_pesanan: string;
  cabang?: string; // 'Cabang 1' | 'Cabang 2'
  nama_pelanggan: string;
  tipe_pesanan?: 'Makan Di Tempat' | 'Bungkus';
  nomor_meja?: string;
  catatan?: string;
  tanggal: string;
  waktu: string;
  total: number;
  items: CartItem[];
  status: 'menunggu_pembayaran' | 'diproses' | 'selesai';
  metode_pembayaran?: string;
  nominal_bayar?: number;
  kembalian?: number;
  transaksi_id?: number;
  user_id: number;
  user_name?: string;
  created_at: string;
}

