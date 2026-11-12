



PRODUCT REQUIREMENTS DOCUMENT

Aplikasi Web (PWA) Kasir & Dashboard Pemilik

BukuPOS


Platform: Web Application (Progressive Web App) — Mobile-First Responsive
Versi: PRD-DRAFT-1
Tanggal: November 2026
Database: IndexedDB (Offline-First) via Dexie.js

Daftar Isi
1. Executive Summary
2. Problem Statement
3. Goals & Objectives
4. User Personas
5. User Stories
6. Analisis Kebutuhan Fungsional
7. Analisis Kebutuhan Non-Fungsional
8. Platform Decision & Arsitektur Teknis
9. Technical Stack
10. Screen Mockup Descriptions
11. Acceptance Criteria
12. Deployment & Operational Model
13. Timeline
14. Appendix: Database Schema & API Endpoints

1. Executive Summary
Dokumen ini menjelaskan spesifikasi produk untuk aplikasi web Progressive Web App (PWA) yang digunakan untuk pencatatan transaksi dan pemantauan penjualan oleh UMKM. Aplikasi dirancang sebagai Web App responsive mobile-first yang dapat diakses dari berbagai perangkat (smartphone, tablet, PC) melalui browser modern tanpa memerlukan instalasi aplikasi native.
Target pengguna terdiri dari dua peran (Role-Based Access Control): (1) Staff Operasional — untuk mencatat transaksi pelanggan melalui antarmuka kasir berbasis grid menu; (2) Pemilik Usaha — untuk memantau dashboard penjualan, grafik tren, menu terlaris, dan informasi laba/rugi. Aplikasi mengadopsi arsitektur offline-first: seluruh data transaksi disimpan secara lokal di browser menggunakan IndexedDB (via Dexie.js), sehingga pencatatan transaksi berjalan normal tanpa koneksi internet. Sinkronisasi data ke pemilik dilakukan melalui ekspor manual file CSV.
2. Problem Statement
BukuPOS saat ini mengatasi permasalahan pencatatan manual dengan buku catatan. Masalah yang dihadapi:
Buku catatan rentan rusak (terkena minyak, kotoran dapur, air) sehingga data transaksi hilang atau tidak terbaca.
Pemilik membutuhkan waktu lama untuk membuat rekap penjualan harian/bulanan karena harus mencocokkan catatan manual secara manual.
Tidak ada mekanisme otomatis untuk mengolah data transaksi menjadi informasi penjualan dan laba/rugi.
Informasi transaksi tidak terstruktur, sulit dipantau, dan tidak dapat digunakan untuk pengambilan keputusan bisnis.
Saat jam sibuk, pencatatan manual lambat dan rentan kesalahan (salah catat, salah baca, buku penuh).
3. Goals & Objectives
Tujuan pengembangan aplikasi:
Merancang proses pencatatan transaksi digital yang sesuai dengan kebutuhan operasional UMKM (mobile-first, offline-capable).
Menyimpan dan mengolah data transaksi secara lokal di browser (IndexedDB) sehingga menghasilkan riwayat transaksi terstruktur tanpa butuh server.
Menyediakan dashboard untuk memantau penjualan, grafik tren, menu terlaris, dan informasi laba/rugi bagi pemilik.
Menyediakan mekanisme ekspor data CSV untuk sinkronisasi manual ke pemilik.
Key Success Metrics:
Waktu pencatatan transaksi < 30 detik per pesanan.
Data transaksi tersimpan dan dapat diakses kembali dari perangkat yang sama (persisten di IndexedDB).
Dashboard menampilkan informasi penjualan harian dan laba/rugi dengan akurat.
Aplikasi dapat dibuka dan digunakan di smartphone (360px–430px lebar) tanpa scroll horizontal.
4. User Personas
Persona 1: Staff Operasional
Nama: Siti (24 tahun)
Peran: Mencatat pesanan pelanggan dan menerima pembayaran di kasir
Perangkat: Smartphone Android/iOS (browser Safari/Chrome)
Kebutuhan: Antarmuka sederhana, responsif, cepat, grid menu visual, keranjang bottom-sheet
Pain points: Buku catatan sulit dibaca, salah catat pesanan, rekap manual memakan waktu, tangan kotor minyak
Persona 2: Pemilik Usaha
Nama: Bapak Agus (45 tahun)
Peran: Memantau perkembangan usaha dan mengambil keputusan bisnis
Perangkat: Smartphone pribadi / Laptop / PC
Kebutuhan: Dashboard ringkas (card KPI), grafik 7/30 hari, menu terlaris, laba/rugi, ekspor CSV
Pain points: Tidak tahu penjualan real-time, sulit analisis tren, rekap manual memakan waktu, tidak di lokasi warung
5. User Stories
US-01: Sebagai Staff Operasional, saya ingin memilih menu dari grid visual (gambar + nama + harga) agar saya dapat mencatat pesanan pelanggan dengan cepat.
US-02: Sebagai Staff Operasional, saya ingin menambah item ke keranjang dengan tap sekali dan mengatur quantity agar total harga dihitung otomatis.
US-03: Sebagai Staff Operasional, saya ingin menyimpan transaksi setelah pembayaran agar data tersimpan di database lokal (IndexedDB) secara offline.
US-04: Sebagai Staff Operasional, saya ingin melihat riwayat transaksi hari ini (dan filter 7/30 hari) agar saya dapat mengecek transaksi sebelumnya.
US-05: Sebagai Staff Operasional, saya ingin menambah/mengedit menu dari Pengaturan agar daftar menu selalu update tanpa butuh bantuan teknis.
US-06: Sebagai Pemilik Usaha, saya ingin melihat dashboard penjualan harian (total penjualan, total transaksi, laba/rugi) dari HP saya agar saya tahu performa usaha tanpa datang ke warung.
US-07: Sebagai Pemilik Usaha, saya ingin melihat grafik penjualan mingguan/bulanan agar saya dapat memantau tren penjualan.
US-08: Sebagai Pemilik Usaha, saya ingin melihat informasi laba/rugi harian agar saya tahu apakah usaha untung atau rugi.
US-09: Sebagai Pemilik Usaha, saya ingin melihat ranking menu terlaris agar saya tahu menu mana yang populer dan menguntungkan.
US-10: Sebagai Pemilik Usaha, saya ingin mengekspor data transaksi ke CSV (pilih rentang tanggal) agar saya dapat melakukan analisis lebih lanjut di Excel/Google Sheets.
US-11: Sebagai Pemilik Usaha, saya ingin mengatur komponen biaya (harga bahan baku per menu, biaya operasional harian) agar perhitungan laba/rugi akurat.
US-12: Sebagai Pemilik Usaha, saya ingin mengelola menu (tambah/edit/hapus/upload gambar) agar data master menu terpusat.

6. Analisis Kebutuhan Fungsional
Analisis kebutuhan fungsional mengidentifikasi fungsi-fungsi sistem yang harus disediakan untuk memenuhi kebutuhan pengguna. Berikut rincian per modul:
6.1 Modul Autentikasi & Otorisasi (RBAC)
FR-A01: Sistem menyediakan halaman login dengan input username dan password.
FR-A02: Sistem membedakan dua peran: "staff" (Staff Operasional) dan "owner" (Pemilik Usaha).
FR-A03: Staff Operasional hanya dapat mengakses: Kasir (Home, Keranjang, Transaksi Tambahan, Riwayat), Pengaturan (Kelola Menu, Profil).
FR-A04: Pemilik Usaha dapat mengakses semua modul termasuk Dashboard, Grafik, Menu Terlaris, Pengaturan Biaya, Kelola Promo, Ekspor Data, Kelola Menu (full CRUD).
FR-A05: Password disimpan sebagai hash (bcrypt/Argon2), tidak plain text.
FR-A06: Sesi login bertahan (persistent) menggunakan localStorage/IndexedDB hingga logout eksplisit.
6.2 Modul Kasir (Staff Operasional)
FR-K01: Sistem menampilkan daftar menu dalam grid responsif (gambar thumbnail, nama menu, harga jual).
FR-K02: Sistem menyediakan filter kategori: Semua, Makanan, Minuman, Snack (data dari master menu).
FR-K03: Sistem menyediakan search bar untuk mencari menu berdasarkan nama.
FR-K04: Tap pada menu menambah item ke keranjang (quantity +1). Tap berulang menambah quantity.
FR-K05: Sistem menampilkan keranjang sebagai bottom-sheet yang dapat di-drag (peek height 80px, full height 60% layar).
FR-K06: Keranjang menampilkan: daftar item (nama, qty, subtotal), total keseluruhan, tombol "Simpan Transaksi" dan "Kosongkan".
FR-K07: Di keranjang, user dapat mengubah quantity per item (+/-) atau menghapus item (swipe kiri).
FR-K08: Sistem menyediakan "Transaksi Tambahan" untuk input manual: nama produk, kode, harga, quantity (untuk item non-menu).
FR-K09: Menyimpan transaksi: membuat record di tabel transaksi + detail_transaksi di IndexedDB, mengosongkan keranjang, menampilkan toast "Transaksi tersimpan".
FR-K10: Riwayat transaksi menampilkan tabel: waktu, item (ringkas), total. Filter: Hari ini / 7 hari / 30 hari.
6.3 Modul Dashboard Pemilik
FR-D01: Dashboard menampilkan 3 KPI Card: Total Penjualan Hari Ini, Total Transaksi Hari Ini, Laba/Rugi Hari Ini.
FR-D02: Grafik penjualan 7 hari terakhir (bar chart), dengan tooltip detail per hari.
FR-D03: Menu Terlaris: ranking top 10 menu (nama, jumlah terjual, total pendapatan), filter 7/30 hari.
FR-D04: Perhitungan laba/rugi: Total Penjualan - (Total Biaya Bahan Baku + Biaya Operasional Harian).
FR-D05: Data di-dashboard bersumber dari IndexedDB lokal (read-only untuk pemilik di perangkat yang sama) atau dari file CSV yang di-import.
6.4 Modul Pengaturan (Shared)
FR-P01: Kelola Menu (CRUD): Tambah, Edit, Hapus menu. Field: nama, harga, kategori, gambar (upload/kamera), status aktif, biaya bahan baku (optional untuk laba/rugi). Staff: Tambah/Edit saja. Pemilik: Full CRUD.
FR-P02: Kelola Kategori: Tambah/Edit/Hapus kategori menu (hanya Pemilik).
FR-P03: Pengaturan Biaya: Input harga bahan baku per menu + biaya operasional harian (hanya Pemilik).
FR-P04: Kelola Promo/Diskon: CRUD promo (nama, tipe: potongan nominal/persen, nilai, tanggal mulai/selesai, status aktif) — hanya Pemilik.
FR-P05: Ekspor Data: Pilih rentang tanggal (mulai - selesai) → generate CSV → download/share (hanya Pemilik).
FR-P06: Profil Akun: Ganti password, ganti foto profil, lihat info role.
FR-P07: Logout: Hapus sesi, redirect ke login.

7. Analisis Kebutuhan Non-Fungsional
Analisis kebutuhan non-fungsional mendefinisikan batasan kualitas dan kendala sistem yang harus dipenuhi:
7.1 Performa
NFR-01: Waktu loading halaman awal (first contentful paint) < 3 detik di jaringan 3G/4G.
NFR-02: Waktu respons interaksi kasir (tap menu → masuk keranjang) < 100ms.
NFR-03: Waktu penyimpanan transaksi ke IndexedDB < 500ms.
NFR-04: Aplikasi mendukung minimal 100 transaksi per hari tanpa degradasi performa.
7.2 Keandalan & Ketahanan
NFR-05: Data transaksi wajib persisten di IndexedDB — survive browser close, restart device, refresh halaman.
NFR-06: Service Worker meng-cache seluruh asset (HTML, JS, CSS, gambar) agar aplikasi bisa dibuka 100% offline.
NFR-07: Ekspor CSV harus valid (UTF-8, delimiter koma, header kolom) dan dapat dibuka Excel/Google Sheets tanpa error.
NFR-08: Tidak ada single point of failure server — sistem berjalan mandiri di perangkat kasir.
7.3 Keamanan
NFR-09: Password di-hash menggunakan bcrypt (cost ≥ 10) atau Argon2id sebelum disimpan.
NFR-10: Role-based access control ditegakkan di sisi client (route guard) — tidak mengandalkan server.
NFR-11: Data sensitif (transaksi, laba/rugi) hanya terlihat oleh role yang berwenang.
NFR-12: Komunikasi (jika ada sync ke cloud di masa depan) menggunakan HTTPS/TLS 1.3.
7.4 Kompatibilitas & Aksesibilitas
NFR-13: Mobile-First Responsive: mendukung resolusi lebar 360px–430px (iPhone SE sampai Android modern) tanpa horizontal scroll.
NFR-14: Cross-browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ (desktop & mobile).
NFR-15: PWA installable: manifest.json, service worker, icons 192/512px, splash screen.
NFR-16: Touch-friendly: target sentuh minimal 44x44px (WCAG 2.1 AA).
NFR-17: Kontras warna minimal 4.5:1 untuk teks (WCAG AA).
7.5 Usability
NFR-18: Alur kasir maksimal 3 langkah: Pilih Menu → Atur Quantity → Simpan Transaksi.
NFR-19: Feedback visual untuk setiap aksi (loading, toast sukses/error, animasi transisi halus).
NFR-20: Error handling ramah pengguna: pesan error bahasa Indonesia jelas, bukan kode teknis.
7.6 Maintainability & Skalabilitas
NFR-21: Kode modular (feature-based folder structure), terdokumentasi, linting (ESLint + Prettier).
NFR-22: Schema IndexedDB versioned (Dexie.js migration) untuk update skema di masa depan.
NFR-23: Arsitektur memungkinkan migrasi ke backend server (Supabase/PocketBase/Firebase) tanpa rewrite total frontend.

8. Platform Decision & Arsitektur Teknis
8.1 Keputusan Platform: Web App (Progressive Web App)
Platform dipilih adalah Web Application berbasis PWA (Progressive Web App) dengan pendekatan Mobile-First Responsive. Alasan pemilihan:
Tidak memerlukan Mac/Xcode untuk build dan testing di iPhone — cukup buka via Safari → "Add to Home Screen".
Satu codebase (HTML/CSS/JS atau React/Vue) berjalan di iOS, Android, Desktop, Tablet.
Offline-first native via Service Worker + IndexedDB — tidak butuh server untuk operasional harian.
Deployment gratis ke Vercel/Netlify/GitHub Pages; update instan tanpa review App Store/Play Store.
Biaya nol untuk infrastruktur server (hosting statis gratis, database lokal di browser).
Mendukung resolusi mobile 360px–430px lebar sebagai target utama (mobile-first).
8.2 Arsitektur Offline-First
Aplikasi mengadopsi arsitektur Offline-First di mana seluruh logika bisnis dan penyimpanan data berjalan di sisi client (browser). Tidak ada backend server yang wajib untuk operasional harian. Sinkronisasi ke pemilik dilakukan melalui mekanisme manual: Ekspor CSV dari perangkat kasir → Kirim via WhatsApp/Email/AirDrop → Pemilik buka di Excel/Google Sheets.
Komponen Arsitektur:
Service Worker (Workbox): Cache asset statis (HTML, JS, CSS, gambar, font) → App Shell model. Strategi: Stale-While-Revalidate untuk asset, Network-First untuk API (jika nanti ada backend).
IndexedDB (Dexie.js): Database relasional di browser. Tabel: user, menu, transaksi, detail_transaksi, biaya, promo, kategori. Mendukung index, query, join, transaksi ACID.
LocalStorage: Menyimpan session token, preferensi UI (theme), versi skema DB.
Manifest.json: Nama aplikasi "BukuPOS", icons 192/512px, start_url, display: standalone, theme_color #FF6038.
Responsive CSS: Tailwind CSS dengan breakpoints mobile-first (sm: 640px, md: 768px, lg: 1024px). Base font size 16px, spacing scale 4px.
8.3 Alur Data (Data Flow)
1. Staff Operasional buka PWA di HP → Service Worker serve cached assets → App load offline.
2. Login → cek kredensial di IndexedDB (tabel user) → set session di LocalStorage → redirect ke Dashboard Kasir.
3. Tap menu → state keranjang update (React/Vue state) → persist ke LocalStorage temporer.
4. Simpan Transaksi → write ke IndexedDB (transaksi + detail_transaksi) dalam satu transaksi DB → clear keranjang → toast sukses.
5. Pemilik buka PWA di perangkat sendiri (atau perangkat yang sama) → Login role owner → Dashboard baca IndexedDB → render KPI, Grafik, Menu Terlaris.
6. Ekspor CSV → Pemilik pilih rentang tanggal → query IndexedDB → generate CSV blob → download/share → buka di Excel/Sheets.

9. Technical Stack
10. Screen Mockup Descriptions
10.1 Login Page
Layout centered card (max-w-md). Input: Username, Password (toggle show/hide). Button: "Masuk" (primary Sunset Orange #FF6038). Footer: "Lupa password?" (optional). Background: Surface #F7F8FA. Error toast di atas form.
10.2 Kasir — Home (Dashboard Kasir)
Header: Avatar + nama staff + badge role "Staff Operasional". Search bar (placeholder "Cari menu..."). Tab Kategori horizontal scroll: Semua | Makanan | Minuman | Snack. Grid Menu: 2 kolom mobile (gap 12px), card: gambar 1:1, nama, harga (Rp), badge "Habis" jika stok 0. Bottom: Cart Bar (peek 80px) — "2 item · Rp 45.000" + icon keranjang. Drag up → Bottom Sheet Keranjang.
10.3 Kasir — Keranjang (Bottom Sheet)
Handle drag indicator. Header: "Keranjang (3 item)". List item: nama, qty stepper (-/+), subtotal, swipe kiri hapus. Divider. Total besar (Rp 67.500). Button full-width: "Simpan Transaksi" (primary), "Kosongkan" (ghost). Tap di luar/backdrop → close sheet.
10.4 Kasir — Transaksi Tambahan
Modal/Full-screen form: Nama Produk*, Kode Produk, Harga*, Quantity* (default 1). Button: "Selesai" (primary) → tambah ke keranjang, "Batal" (secondary). Validasi: nama & harga wajib diisi, harga angka positif.
10.5 Kasir — Riwayat Transaksi
Header: "Riwayat Transaksi". Filter chips: Hari Ini | 7 Hari | 30 Hari. Tabel: Waktu | Item (ringkas, max 2 nama + "...") | Total. Empty state: "Belum ada transaksi". Pull-to-refresh.
10.6 Pemilik — Dashboard Utama
Header: "Dashboard Pemilik". 3 KPI Card grid 1 kolom mobile: Total Penjualan Hari Ini (Rp 1.250.000), Total Transaksi (24), Laba/Rugi (Rp 450.000). Grafik: Bar Chart 7 Hari Terakhir (X: tanggal, Y: nominal). Legend: Penjualan, Laba. Quick links: Menu Terlaris, Pengaturan Biaya, Ekspor Data.
10.7 Pemilik — Menu Terlaris
Header + Filter 7/30 Hari. Tabel Ranking: No | Nama Menu | Terjual | Pendapatan. Sort default: Terjual desc. Empty state: "Belum ada data penjualan".
10.8 Pemilik — Pengaturan Biaya
Daftar menu (dari master menu) dengan input: Harga Bahan Baku per porsi. Di bawah: Biaya Operasional Harian (input angka). Button: "Simpan Perhitungan". Preview Laba/Rugi real-time di samping.
10.9 Pemilik — Kelola Promo
Tabel: Nama Promo | Tipe (Nominal/Persen) | Nilai | Periode | Status (Aktif/Tidak). Button: "Tambah Promo" → Modal: nama, tipe, nilai, tanggal mulai/selesai, toggle aktif.
10.10 Pemilik — Ekspor Data
Date Range Picker: Tanggal Mulai, Tanggal Selesai (default: 30 hari terakhir). Button: "Ekspor CSV" → generate & download file: transaksi_YYYYMMDD_YYYYMMDD.csv. Toast: "File siap diunduh".
10.11 Pengaturan — Kelola Menu (CRUD)
Tabel: Gambar | Nama | Harga | Kategori | Status | Aksi. Button: "Tambah Menu" → Modal Form: Nama*, Harga*, Kategori* (dropdown), Gambar (upload/kamera), Biaya Bahan Baku (opsional), Status Aktif (toggle). Edit: prefill form. Hapus: konfirmasi modal.
10.12 Pengaturan — Profil & Akun
Form: Foto Profil (upload), Username (read-only), Ganti Password (lama, baru, konfirmasi), Role (badge). Button: "Simpan Perubahan", "Logout" (danger).

11. Acceptance Criteria
AC-01: Staff Operasional dapat login dengan username/password dan diarahkan ke Dashboard Kasir dalam < 2 detik.
AC-02: Grid menu menampilkan gambar, nama, harga dengan benar; tap menu menambah ke keranjang (qty +1) dan Cart Bar update real-time.
AC-03: Keranjang bottom-sheet menampilkan item, qty, subtotal, total; stepper +/- dan swipe hapus berfungsi; total akurat.
AC-04: "Simpan Transaksi" menyimpan data ke IndexedDB (tabel transaksi + detail_transaksi), mengosongkan keranjang, menampilkan toast sukses.
AC-05: Riwayat transaksi menampilkan data hari ini dengan benar; filter 7/30 hari berfungsi.
AC-06: Transaksi Tambahan menerima input manual dan menambah item ke keranjang dengan benar.
AC-07: Pemilik login role owner → Dashboard menampilkan 3 KPI Card dengan nilai yang sesuai data IndexedDB.
AC-08: Grafik 7 hari menampilkan batang per tanggal dengan tooltip detail; data akurat.
AC-09: Menu Terlaris ranking top 10 berdasarkan jumlah terjual; filter 7/30 hari berfungsi.
AC-10: Laba/Rugi dihitung: Total Penjualan - (Σ(qty × biaya_bahan_baku) + biaya_operasional_harian); nilai akurat.
AC-11: Kelola Menu CRUD: Tambah/Edit/Hapus menu persisten di IndexedDB; gambar tersimpan (base64/blob URL).
AC-12: Pengaturan Biaya: input bahan baku per menu + operasional harian → perhitungan laba/rugi update real-time.
AC-13: Ekspor CSV: file valid UTF-8, header kolom: tanggal,waktu,menu,jumlah,harga,subtotal,total; dibuka Excel tanpa error.
AC-14: Aplikasi responsive di lebar 360px (iPhone SE) hingga 1920px (desktop) tanpa horizontal scroll.
AC-15: PWA installable: prompt "Install App" muncul di Safari/Chrome; icon di home screen; buka standalone full-screen.
AC-16: Offline mode: matikan internet → buka aplikasi → login → transaksi → simpan → data tersimpan di IndexedDB; nyalakan internet → data tetap ada.
AC-17: Role guard: Staff tidak bisa akses URL /dashboard, /pengaturan-biaya, /ekspor, /promo (redirect ke /kasir).
AC-18: Password di-hash (bcrypt) di IndexedDB; tidak ada plain text password di devtools Application tab.
12. Deployment & Operational Model
12.1 Hosting & Deployment
Aplikasi di-deploy sebagai static site ke hosting gratis: Vercel (rekomendasi), Netlify, atau GitHub Pages. Build command: `npm run build` (Vite) → output folder `dist/`. Custom domain (opsional): kasirku.app / skb.pos / domain sendiri. HTTPS otomatis dari provider hosting.
12.2 Model Operasional Harian
1. Staff Operasional buka PWA di HP kasir (sudah di-install ke Home Screen).
2. Selama jam operasional: pencatatan transaksi berjalan offline-normal (IndexedDB).
3. Akhir shift/hari: Staff tap "Ekspor CSV" (jika punya akses) atau Pemilik buka PWA di HP kasir yang sama → Ekspor CSV → Share ke WhatsApp/Email.
4. Pemilik buka CSV di Laptop/PC → Analisis di Excel/Google Sheets (pivot, grafik, dll).
5. Backup berkala: Copy folder `dist/` + data IndexedDB (via ekspor JSON full) ke Google Drive/USB.
12.3 Migrasi Masa Depan (Opsional)
Jika nanti butuh multi-device real-time sync: 1. Tambah backend (Supabase / PocketBase / Firebase / custom API). 2. IndexedDB jadi local cache + sync engine (Yjs / ElectricSQL / custom). 3. Frontend minim perubahan (hanya ganti repository layer). 4. Schema DB sudah siap (tabel user, menu, transaksi, detail, biaya, promo).

13. Timeline

14. Appendix
14.1 Database Schema (IndexedDB via Dexie.js)
Tabel: user
  - id (Primary Key, auto-increment)
  - username (String, unique)
  - password_hash (String, bcrypt/Argon2)
  - role (String: "staff" | "owner")
  - nama_lengkap (String, optional)
  - foto_url (String, base64/blob URL, optional)
  - created_at (DateTime)
Tabel: menu
  - id (Primary Key, auto-increment)
  - nama (String)
  - harga (Number, integer Rupiah)
  - kategori (String: "Makanan" | "Minuman" | "Snack" | "Lainnya")
  - gambar_url (String, base64/blob URL, optional)
  - biaya_bahan_baku (Number, optional, untuk hitung laba/rugi)
  - aktif (Boolean, default true)
  - created_at, updated_at (DateTime)
Tabel: transaksi
  - id (Primary Key, auto-increment)
  - tanggal (String, YYYY-MM-DD)
  - waktu (String, HH:mm:ss)
  - total (Number, integer Rupiah)
  - user_id (Foreign Key → user.id)
  - created_at (DateTime)
Tabel: detail_transaksi
  - id (Primary Key, auto-increment)
  - transaksi_id (Foreign Key → transaksi.id)
  - menu_id (Foreign Key → menu.id, nullable untuk transaksi tambahan)
  - nama_item (String, snapshot nama saat transaksi)
  - harga_satuan (Number, snapshot harga saat transaksi)
  - jumlah (Number, integer)
  - subtotal (Number, harga_satuan × jumlah)
  - is_manual (Boolean, true jika transaksi tambahan non-menu)
Tabel: biaya
  - id (Primary Key, auto-increment)
  - tanggal (String, YYYY-MM-DD)
  - biaya_operasional (Number, integer Rupiah)
  - created_at (DateTime)
Tabel: promo
  - id (Primary Key, auto-increment)
  - nama (String)
  - tipe (String: "nominal" | "persen")
  - nilai (Number)
  - tanggal_mulai, tanggal_selesai (String, YYYY-MM-DD)
  - aktif (Boolean)
  - created_at (DateTime)
Tabel: kategori
  - id (Primary Key, auto-increment)
  - nama (String, unique)
  - urutan (Number, untuk sort tampilan)
  - aktif (Boolean)
14.2 API Endpoints (RESTful — untuk Referensi Backend Masa Depan)
POST   /api/auth/login           - Login user (return session token)
POST   /api/auth/logout          - Logout (invalidate session)
GET    /api/menu                 - Get all menu (filter: kategori, aktif)
POST   /api/menu                 - Create menu (owner only)
PUT    /api/menu/:id             - Update menu (owner only)
DELETE /api/menu/:id             - Delete menu (owner only)
POST   /api/transaksi            - Create transaction (staff/owner)
GET    /api/transaksi            - List transaksi (query: tanggal, user_id, limit)
GET    /api/transaksi/:id        - Get detail transaksi
GET    /api/dashboard/ringkasan  - KPI harian: total_penjualan, total_transaksi, laba_rugi
GET    /api/dashboard/grafik     - Data grafik 7/30 hari (tanggal, penjualan, laba)
GET    /api/dashboard/terlaris   - Menu terlaris (query: periode=7|30)
POST   /api/biaya                - Simpan biaya operasional harian (owner)
GET    /api/biaya                - Get biaya (query: tanggal)
POST   /api/promo                - CRUD Promo (owner)
GET    /api/export/csv           - Export transaksi CSV (query: start, end)
14.3 Glossary
PWA (Progressive Web App): Aplikasi web yang memiliki kemampuan seperti native app (installable, offline, push notification) melalui Service Worker dan Web App Manifest.
IndexedDB: Database NoSQL bawaan browser yang mendukung penyimpanan data besar, transaksi, index, dan query — cocok untuk aplikasi offline-first.
Dexie.js: Wrapper TypeScript/JavaScript untuk IndexedDB yang menyediakan API mirip ORM (schema, query, relasi, migrasi).
Service Worker: Script yang berjalan di background browser, mengontrol caching asset dan network request — kunci offline capability.
Workbox: Library Google untuk menghasilkan Service Worker dengan strategi caching best-practice (StaleWhileRevalidate, CacheFirst, NetworkFirst).
Mobile-First Responsive: Pendekatan desain dimana stylesheet dasar untuk mobile (≤ 640px), lalu progressive enhancement ke tablet/desktop via media query min-width.
RBAC (Role-Based Access Control): Model otorisasi di mana akses dibatasi berdasarkan peran (role) pengguna, bukan identitas individu.
Offline-First: Arsitektur di mana aplikasi dirancang berfungsi penuh tanpa koneksi internet; sinkronisasi ke server (jika ada) terjadi di background/on-demand.
CSV (Comma-Separated Values): Format file teks tabular sederhana, kompatibel universal dengan Excel, Google Sheets, database.
