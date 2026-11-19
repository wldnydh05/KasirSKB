-- 003: Sinkronkan skema Supabase dengan field yang benar-benar dikirim aplikasi
-- (fix push sync: kolom hilang + CHECK constraint yang melanggar data aplikasi)

-- ============================================
-- USERS: role pakai 'staff' (bukan 'kasir'), foto & nama lengkap
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS foto_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nama_lengkap TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('owner', 'staff', 'kasir'));

-- ============================================
-- MENUS: harga custom untuk Bebek (kasir ketik sendiri 13rb-20rb)
-- ============================================
ALTER TABLE menus ADD COLUMN IF NOT EXISTS harga_custom BOOLEAN DEFAULT FALSE;
ALTER TABLE menus ADD COLUMN IF NOT EXISTS harga_range TEXT;

-- ============================================
-- TRANSAKSI: field opsional yang dikirim aplikasi
-- ============================================
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS nomor_pesanan TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS nama_pelanggan TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS tipe_pesanan TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS nomor_meja TEXT;
ALTER TABLE transaksi ADD COLUMN IF NOT EXISTS catatan TEXT;

-- ============================================
-- PROMO: tipe aplikasi = 'persen' | 'nominal'
-- ============================================
ALTER TABLE promo DROP CONSTRAINT IF EXISTS promo_tipe_check;
ALTER TABLE promo ADD CONSTRAINT promo_tipe_check
  CHECK (tipe IN ('persen', 'nominal', 'diskon_persen', 'diskon_nominal', 'beli_x_gratis_y'));

-- ============================================
-- PESANAN_AKTIF: status aplikasi = 'menunggu_pembayaran' + field detail pesanan
-- ============================================
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS nama_pelanggan TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS tipe_pesanan TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS nomor_meja TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS waktu TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS metode_pembayaran TEXT;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS nominal_bayar INTEGER;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS kembalian INTEGER;
ALTER TABLE pesanan_aktif ADD COLUMN IF NOT EXISTS transaksi_id BIGINT;
ALTER TABLE pesanan_aktif DROP CONSTRAINT IF EXISTS pesanan_aktif_status_check;
ALTER TABLE pesanan_aktif ADD CONSTRAINT pesanan_aktif_status_check
  CHECK (status IN ('menunggu_pembayaran', 'menunggu', 'diproses', 'selesai', 'dibatalkan'));

-- ============================================
-- BIAYA: aplikasi pakai 'keterangan' + rincian JSON
-- ============================================
ALTER TABLE biaya ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE biaya ADD COLUMN IF NOT EXISTS rincian JSONB;
