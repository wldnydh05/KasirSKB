-- Supabase Schema for BukuPOS (Fixed for UUID auth.uid())
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  uuid UUID UNIQUE DEFAULT gen_random_uuid(),  -- For Supabase Auth linkage
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'kasir')),
  cabang TEXT,
  pin_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_cabang ON users(cabang);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_synced ON users(synced) WHERE synced = FALSE;

-- ============================================
-- KATEGORI TABLE
-- ============================================
CREATE TABLE kategori (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT UNIQUE NOT NULL,
  urutan INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_kategori_aktif ON kategori(aktif);
CREATE INDEX idx_kategori_synced ON kategori(synced) WHERE synced = FALSE;

-- ============================================
-- MENUS TABLE
-- ============================================
CREATE TABLE menus (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  harga INTEGER NOT NULL,
  kategori TEXT NOT NULL,
  biaya_bahan_baku INTEGER DEFAULT 0,
  aktif BOOLEAN DEFAULT TRUE,
  gambar_url TEXT DEFAULT '',
  cabang TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_menus_kategori ON menus(kategori);
CREATE INDEX idx_menus_aktif ON menus(aktif);
CREATE INDEX idx_menus_cabang ON menus USING GIN(cabang);
CREATE INDEX idx_menus_synced ON menus(synced) WHERE synced = FALSE;

-- ============================================
-- TRANSAKSI TABLE
-- ============================================
CREATE TABLE transaksi (
  id BIGSERIAL PRIMARY KEY,
  tanggal TEXT NOT NULL,
  waktu TEXT NOT NULL,
  total INTEGER NOT NULL,
  user_id BIGINT REFERENCES users(id),
  user_name TEXT NOT NULL,
  cabang TEXT NOT NULL,
  metode_pembayaran TEXT DEFAULT 'Tunai',
  nominal_bayar INTEGER DEFAULT 0,
  kembalian INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transaksi_tanggal ON transaksi(tanggal);
CREATE INDEX idx_transaksi_cabang ON transaksi(cabang);
CREATE INDEX idx_transaksi_user_id ON transaksi(user_id);
CREATE INDEX idx_transaksi_synced ON transaksi(synced) WHERE synced = FALSE;

-- ============================================
-- DETAIL_TRANSAKSI TABLE
-- ============================================
CREATE TABLE detail_transaksi (
  id BIGSERIAL PRIMARY KEY,
  transaksi_id BIGINT NOT NULL REFERENCES transaksi(id) ON DELETE CASCADE,
  menu_id BIGINT REFERENCES menus(id),
  nama_item TEXT NOT NULL,
  harga_satuan INTEGER NOT NULL,
  biaya_bahan_baku INTEGER DEFAULT 0,
  jumlah INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  is_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_detail_transaksi_transaksi_id ON detail_transaksi(transaksi_id);
CREATE INDEX idx_detail_transaksi_menu_id ON detail_transaksi(menu_id);
CREATE INDEX idx_detail_transaksi_synced ON detail_transaksi(synced) WHERE synced = FALSE;

-- ============================================
-- BIAYA TABLE
-- ============================================
CREATE TABLE biaya (
  id BIGSERIAL PRIMARY KEY,
  tanggal TEXT NOT NULL,
  biaya_operasional INTEGER DEFAULT 0,
  biaya_operasional_lainnya INTEGER DEFAULT 0,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_biaya_tanggal ON biaya(tanggal);
CREATE INDEX idx_biaya_synced ON biaya(synced) WHERE synced = FALSE;

-- ============================================
-- PROMO TABLE
-- ============================================
CREATE TABLE promo (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  tipe TEXT NOT NULL CHECK (tipe IN ('diskon_persen', 'diskon_nominal', 'beli_x_gratis_y')),
  nilai INTEGER NOT NULL,
  syarat_minimal_belanja INTEGER DEFAULT 0,
  maksimal_diskon INTEGER,
  aktif BOOLEAN DEFAULT TRUE,
  tanggal_mulai TEXT,
  tanggal_selesai TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_promo_aktif ON promo(aktif);
CREATE INDEX idx_promo_tanggal ON promo(tanggal_mulai, tanggal_selesai);
CREATE INDEX idx_promo_synced ON promo(synced) WHERE synced = FALSE;

-- ============================================
-- PESANAN_AKTIF TABLE
-- ============================================
CREATE TABLE pesanan_aktif (
  id BIGSERIAL PRIMARY KEY,
  nomor_pesanan TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('menunggu', 'diproses', 'selesai', 'dibatalkan')),
  tanggal TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  cabang TEXT NOT NULL,
  user_id BIGINT REFERENCES users(id),
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_pesanan_aktif_status ON pesanan_aktif(status);
CREATE INDEX idx_pesanan_aktif_tanggal ON pesanan_aktif(tanggal);
CREATE INDEX idx_pesanan_aktif_cabang ON pesanan_aktif(cabang);
CREATE INDEX idx_pesanan_aktif_synced ON pesanan_aktif(synced) WHERE synced = FALSE;

-- ============================================
-- CABANG LIST (stored as a single row in a config table)
-- ============================================
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES 
('cabang_list', '["Cabang 1"]'::jsonb),
('app_version', '"1.0.0"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE detail_transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE biaya ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesanan_aktif ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- POLICY: Allow all operations for anon/service roles (bypass RLS for sync)
-- Since we use anon key for client sync, we need permissive policies
-- Real auth integration can be added later

-- Users: Allow read/write for all (sync uses anon key)
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_kategori" ON kategori FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_menus" ON menus FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transaksi" ON transaksi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_detail_transaksi" ON detail_transaksi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_biaya" ON biaya FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_promo" ON promo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pesanan_aktif" ON pesanan_aktif FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_app_config" ON app_config FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kategori_updated_at BEFORE UPDATE ON kategori FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON menus FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaksi_updated_at BEFORE UPDATE ON transaksi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_detail_transaksi_updated_at BEFORE UPDATE ON detail_transaksi FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_biaya_updated_at BEFORE UPDATE ON biaya FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_promo_updated_at BEFORE UPDATE ON promo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pesanan_aktif_updated_at BEFORE UPDATE ON pesanan_aktif FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE users, kategori, menus, transaksi, detail_transaksi, biaya, promo, pesanan_aktif, app_config;